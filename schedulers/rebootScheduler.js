const mongo = require("../modules/mongo");
const velocityMetrics = require("../modules/velocityMetrics");
const pterodactyl = require("../modules/pterodactyl");
const timeManager = require("../modules/timeManager");
const functions = require("../modules/functions");
const { EmbedBuilder } = require("discord.js");
const sessionLogger = require("../modules/sessionLogger");

module.exports = {
    name: 'rebootScheduler',
    defaultConfig: {
        "active": true,
        "interval": 300, // Check for reboots every 5 minutes (300 seconds)
        "maxConcurrentReboots": 4, // Per node capacity
        "rebootRetryLimit": 3,
        "serverStartupTimeout": 20, // Minutes
        "batchingStrategy": "auto", // "auto" = dynamic based on nodes, "fixed" = use maxBatchSize
        "maxBatchSize": 12, // Only used if batchingStrategy is "fixed"
        "playerThreshold": 25 // Reboot when less than this many players online
    },

    // Internal state tracking
    state: {
        isRebootInProgress: false,
        rebootStartTime: null,
        rebootQueue: [],
        activeReboots: new Map(), // serverId -> { attempts, startTime, nodeId }
        todayStats: {
            lowestPlayerCount: null,
            lowestPlayerTime: null,
            rebootTriggered: false,
            rebootCompleted: false
        }
    },

    /**
     * Starts the reboot scheduler
     * @param {object} options Configuration options
     */
    start: async function (options) {
        sessionLogger.info('RebootScheduler', `Reboot Scheduler started - checking every ${options.interval} seconds`);
        sessionLogger.info('RebootScheduler', `Max concurrent reboots per node: ${options.maxConcurrentReboots}`);
        sessionLogger.info('RebootScheduler', `Player threshold for reboot: ${options.playerThreshold}`);
        
        // Store runtime config for use throughout the module
        this.runtimeConfig = options;
        
        // Initialize today's stats
        try {
            await this.initializeTodayStats();
            sessionLogger.info('RebootScheduler', 'Today stats initialized successfully');
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Failed to initialize today stats', error.message);
        }
        
        // Perform state recovery check
        try {
            await this.recoverFromInterruptedReboot();
            sessionLogger.info('RebootScheduler', 'State recovery check completed');
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Failed state recovery check', error.message);
        }
        
        // Start the main monitoring loop
        setInterval(() => this.mainLoop(options), options.interval * 1000);
        
        // Run initial check after a short delay
        setTimeout(() => this.mainLoop(options), options.interval * 1000);
    },

    /**
     * Main monitoring loop
     * @param {object} options Configuration options
     */
    mainLoop: async function (options) {
        try {
            // Update player statistics
            await this.updatePlayerStats();
            
            // Check for reboot scheduling
            if (!this.state.isRebootInProgress && !this.state.todayStats.rebootCompleted) {
                await this.checkRebootSchedule(options);
            }
            
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error in rebootScheduler.mainLoop:', error.message);
        }
    },

    /**
     * Initialize today's statistics
     */
    initializeTodayStats: async function () {
        const today = timeManager.getTodayDateString();
        const existingStats = await mongo.getRebootHistory(today);
        
        if (existingStats) {
            this.state.todayStats = existingStats;
            // Ensure retryAttempts exists for backward compatibility
            if (!this.state.todayStats.retryAttempts) {
                this.state.todayStats.retryAttempts = {};
            }
        } else {
            this.state.todayStats = {
                date: today,
                lowestPlayerCount: null,
                lowestPlayerTime: null,
                rebootTriggered: false,
                rebootCompleted: false,
                rebootStartTime: null,
                rebootEndTime: null,
                successfulReboots: 0,
                failedReboots: 0,
                totalServers: 0,
                retryAttempts: {}
            };
        }
    },

    /**
     * Update current player statistics
     */
    updatePlayerStats: async function () {
        try {
            const playersData = await velocityMetrics.getPlayers();
            let totalPlayers = 0;
            
            // Count total players across all servers
            for (const serverName in playersData) {
                totalPlayers += playersData[serverName].length;
            }
            
            const currentTime = timeManager.getCurrentTimeGMT3();
            const timeWindow = timeManager.checkRebootWindow();
            
            // Update lowest player count
            if (this.state.todayStats.lowestPlayerCount === null || totalPlayers < this.state.todayStats.lowestPlayerCount) {
                this.state.todayStats.lowestPlayerCount = totalPlayers;
                this.state.todayStats.lowestPlayerTime = currentTime.toISOString();
                
                // Save to database
                await mongo.updateRebootHistory(timeManager.getTodayDateString(), this.state.todayStats);
            }
            
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error updating player stats:', error.message);
        }
    },

    /**
     * Check if reboot should be scheduled
     */
    checkRebootSchedule: async function (options) {
        try {
            const playersData = await velocityMetrics.getPlayers();
            
            let totalPlayers = 0;
            for (const serverName in playersData) {
                totalPlayers += playersData[serverName].length;
            }
            
            // PREVENT DUPLICATE TRIGGERS - Only start if not already running
            if (this.state.isRebootInProgress) {
                sessionLogger.info('RebootScheduler', 'Reboot already in progress, skipping trigger check');
                return;
            }
            
            // Simple trigger logic: reboot if less than threshold players
            let shouldTrigger = false;
            let triggerReason = '';
            
            if (totalPlayers < options.playerThreshold) {
                shouldTrigger = true;
                triggerReason = `Low player count (${totalPlayers} < ${options.playerThreshold})`;
            }
            
            if (shouldTrigger) {
                await this.triggerRebootSequence(triggerReason, totalPlayers, options);
            }
            
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error checking reboot schedule:', error.message);
        }
    },

    /**
     * Filter servers based on uptime requirement (minimum 6 hours)
     * @param {Array} servers Array of server objects
     * @param {number} minimumUptimeHours Minimum uptime in hours (default: 6)
     * @returns {object} Object with eligible and skipped servers
     */
    filterServersByUptime: async function (servers, minimumUptimeHours = 6) {
        const eligible = [];
        const skipped = [];
        
        sessionLogger.info('RebootScheduler', `Checking uptime for ${servers.length} servers (minimum: ${minimumUptimeHours}h)...`);
        
        // Check uptime for all servers in parallel for efficiency
        const uptimePromises = servers.map(async (server) => {
            try {
                const uptimeHours = await pterodactyl.getServerUptime(server.serverId);
                return { server, uptimeHours };
            } catch (error) {
                sessionLogger.error('RebootScheduler', `Error checking uptime for ${server.name}:`, error.message);
                // On error, assume server needs reboot (include it)
                return { server, uptimeHours: minimumUptimeHours };
            }
        });
        
        const uptimeResults = await Promise.allSettled(uptimePromises);
        
        uptimeResults.forEach((result, index) => {
            const server = servers[index];
            
            if (result.status === 'fulfilled') {
                const { uptimeHours } = result.value;
                
                if (uptimeHours >= minimumUptimeHours) {
                    eligible.push(server);
                    sessionLogger.info('RebootScheduler', `✅ ${server.name}: ${uptimeHours}h uptime - eligible for reboot`);
                } else {
                    skipped.push({ server, uptimeHours });
                    sessionLogger.info('RebootScheduler', `⏭️ ${server.name}: ${uptimeHours}h uptime - skipping (too recent)`);
                }
            } else {
                // On error, include server in eligible list (fail-safe approach)
                eligible.push(server);
                sessionLogger.warn('RebootScheduler', `⚠️ ${server.name}: uptime check failed - including in reboot (fail-safe)`);
            }
        });
        
        sessionLogger.info('RebootScheduler', `Uptime filtering complete: ${eligible.length} eligible, ${skipped.length} skipped`);
        
        return { eligible, skipped };
    },

    /**
     * Trigger the complete reboot sequence
     * @param {string} reason Reason for triggering
     * @param {number} currentPlayerCount Current player count
     * @param {object} config Runtime configuration
     */
    triggerRebootSequence: async function (reason, currentPlayerCount, config) {
        sessionLogger.info('RebootScheduler', `Triggering reboot sequence: ${reason}`);
        
        this.state.isRebootInProgress = true;
        this.state.rebootStartTime = Date.now();
        this.state.todayStats.rebootTriggered = true;
        this.state.todayStats.rebootStartTime = new Date().toISOString();
        this.state.todayStats.triggerReason = reason;
        this.state.todayStats.triggerPlayerCount = currentPlayerCount;
        
        // Get all servers that need rebooting
        const servers = await mongo.getServers();
        
        // Debug: Log all servers and their exclusion status
        sessionLogger.info('RebootScheduler', `Total servers found: ${servers.length}`);
        servers.forEach(server => {
            const excluded = server.excludeFromServerList;
            const earlyAccess = server.early_access;
            const shouldReboot = this.shouldRebootServer(server);
            sessionLogger.info('RebootScheduler', `Server ${server.tag}: excludeFromServerList=${excluded}, early_access=${earlyAccess}, shouldReboot=${shouldReboot}`);
        });
        
        const initialEligibleServers = servers.filter(server => 
            !server.early_access &&
            this.shouldRebootServer(server)
        );
        
        sessionLogger.info('RebootScheduler', `Initial eligible servers: ${initialEligibleServers.map(s => s.tag).join(', ')}`);
        
        // Check for missing GTSE/GTNG specifically
        const gtseServer = servers.find(s => s.tag === 'GTSE');
        const gtngServer = servers.find(s => s.tag === 'GTNG');
        if (gtseServer) sessionLogger.info('RebootScheduler', `GTSE status: excludeFromServerList=${gtseServer.excludeFromServerList}, early_access=${gtseServer.early_access}`);
        if (gtngServer) sessionLogger.info('RebootScheduler', `GTNG status: excludeFromServerList=${gtngServer.excludeFromServerList}, early_access=${gtngServer.early_access}`);
        
        // Apply uptime filtering - only reboot servers with >6 hours uptime
        const uptimeFilterResult = await this.filterServersByUptime(initialEligibleServers, 6);
        const finalEligibleServers = uptimeFilterResult.eligible;
        
        sessionLogger.info('RebootScheduler', `Final servers for reboot after uptime filtering: ${finalEligibleServers.map(s => s.tag).join(', ')}`);
        
        if (uptimeFilterResult.skipped.length > 0) {
            sessionLogger.info('RebootScheduler', `Skipped servers (insufficient uptime): ${uptimeFilterResult.skipped.map(s => `${s.server.tag}(${s.uptimeHours}h)`).join(', ')}`);
        }
        
        this.state.todayStats.totalServers = finalEligibleServers.length;
        this.state.rebootQueue = [...finalEligibleServers];
        
        // Save initial stats with error handling
        try {
            await mongo.updateRebootHistory(timeManager.getTodayDateString(), this.state.todayStats);
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error saving initial reboot stats:', error.message);
            // Continue anyway - don't let DB failures stop the reboot
        }
        
        // Send notification to staff channel with error handling
        try {
            await this.sendRebootNotification('start', { reason, playerCount: currentPlayerCount, serverCount: finalEligibleServers.length });
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error sending start notification:', error.message);
            // Continue anyway - don't let Discord failures stop the reboot
        }
        
        // Start processing the queue
        await this.processRebootQueue(config);
    },

    /**
     * Check if server should be rebooted based on uptime and eligibility
     * @param {object} server Server object
     * @returns {boolean} Should reboot
     */
    shouldRebootServer: function (server) {
        // Skip servers with specific tags or conditions
        const excludedTags = ["BINGO", "ALP", "PLUS"];
        if (excludedTags.includes(server.tag)) {
            sessionLogger.info('RebootScheduler', `Excluding ${server.tag}: in excludedTags list`);
            return false;
        }
        
        // DEBUG: Check for any other exclusion reasons
        if (server.tag === 'GTSE' || server.tag === 'GTNG') {
            sessionLogger.info('RebootScheduler', `${server.tag}: Passed shouldRebootServer check`);
        }
        
        // Check if server has been up for reasonable time
        // This would require tracking server start times
        // For now, return true for all eligible servers
        return true;
    },

    /**
     * Process the reboot queue with TRUE PARALLEL EXECUTION
     * PERFORMANCE FIX: Dynamic servers simultaneously across nodes
     * @param {object} config Runtime configuration options
     */
    processRebootQueue: async function (config = this.defaultConfig) {
        sessionLogger.info('RebootScheduler', `Starting PARALLEL reboot of ${this.state.rebootQueue.length} servers`);
        
        // Discover real node infrastructure
        const realNodes = await this.discoverRealNodes();
        
        // Map servers to real nodes
        const serverNodeMapping = await this.mapServersToRealNodes(this.state.rebootQueue, realNodes);
        
        // DYNAMIC BATCHING - Calculate optimal batch size automatically
        const batchConfig = this.calculateOptimalBatching(realNodes, this.state.rebootQueue.length, config);
        
        sessionLogger.info('RebootScheduler', `Processing ${this.state.rebootQueue.length} servers in ${batchConfig.totalBatches} dynamic batches`);
        sessionLogger.info('RebootScheduler', `Batch strategy: ${batchConfig.strategy}, Max per batch: ${batchConfig.batchSize}`);
        
        for (let batchIndex = 0; batchIndex < batchConfig.totalBatches; batchIndex++) {
            const batchStart = batchIndex * batchConfig.batchSize;
            const batchEnd = Math.min(batchStart + batchConfig.batchSize, this.state.rebootQueue.length);
            const currentBatch = this.state.rebootQueue.slice(batchStart, batchEnd);
            
            sessionLogger.info('RebootScheduler', `BATCH ${batchIndex + 1}/${batchConfig.totalBatches}: Processing ${currentBatch.length} servers SIMULTANEOUSLY`);
            
            // Group current batch by nodes
            const batchByNode = this.groupServersByNode(currentBatch, serverNodeMapping);
            
            // Start ALL nodes in parallel - THIS IS THE FIX!
            const nodePromises = [];
            for (const [nodeId, servers] of batchByNode.entries()) {
                sessionLogger.info('RebootScheduler', `Node ${nodeId}: Starting ${servers.length} servers in parallel`);
                const nodePromise = this.processNodeBatch(nodeId, servers, config);
                nodePromises.push(nodePromise);
            }
            
            // Wait for ALL nodes to complete simultaneously - using allSettled for fault tolerance
            const nodeResults = await Promise.allSettled(nodePromises);
            
            // Process results and log individual node failures
            let successfulNodes = 0;
            let failedNodes = 0;
            
            nodeResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successfulNodes++;
                } else {
                    failedNodes++;
                    sessionLogger.error('RebootScheduler', `Node ${index + 1} failed:`, result.reason?.message || result.reason);
                }
            });
            
            sessionLogger.info('RebootScheduler', `BATCH ${batchIndex + 1} COMPLETED: ${successfulNodes} nodes successful, ${failedNodes} nodes failed`);
            
            // Brief delay between batches for stability
            if (batchIndex + 1 < batchConfig.totalBatches) {
                sessionLogger.info('RebootScheduler', 'Cooling down 30 seconds before next batch...');
                await functions.sleep(30000);
            }
        }
        
        sessionLogger.info('RebootScheduler', 'ALL SERVERS PROCESSED - MASSIVE PERFORMANCE IMPROVEMENT ACHIEVED!');
        await this.completeRebootSequence();
    },

    /**
     * Discover REAL Pterodactyl node infrastructure via API
     * Replaces fake "node-x" assignments with actual node discovery
     */
    discoverRealNodes: async function () {
        try {
            sessionLogger.info('RebootScheduler', 'Discovering real Pterodactyl nodes...');
            const realNodes = await pterodactyl.getNodes();
            
            if (realNodes && realNodes.length > 0) {
                sessionLogger.info('RebootScheduler', `Discovered ${realNodes.length} real nodes:`);
                realNodes.forEach(node => {
                    const memUsage = ((node.memory.allocated / node.memory.total) * 100).toFixed(1);
                    const diskUsage = ((node.disk.allocated / node.disk.total) * 100).toFixed(1);
                    sessionLogger.info('RebootScheduler', `  ${node.name} (${node.fqdn}): RAM ${memUsage}%, Disk ${diskUsage}%`);
                });
                return realNodes;
            } else {
                throw new Error('No nodes returned from API');
            }
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error discovering real nodes, using fallback:', error.message);
            return [
                { id: 'lithium-fallback', name: 'Lithium (Fallback)', capacity: 4 },
                { id: 'uranium-fallback', name: 'Uranium (Fallback)', capacity: 4 },
                { id: 'neptunium-fallback', name: 'Neptunium (Fallback)', capacity: 4 }
            ];
        }
    },

    /**
     * Map servers to real nodes with simple round-robin distribution
     * Simplified to avoid API timeouts during reboot operations
     */
    mapServersToRealNodes: async function (servers, realNodes) {
        const mapping = new Map();
        
        sessionLogger.info('RebootScheduler', 'Mapping servers to nodes with round-robin distribution...');
        
        // Simple round-robin distribution
        servers.forEach((server, index) => {
            const nodeIndex = index % realNodes.length;
            const assignedNode = realNodes[nodeIndex];
            mapping.set(server.serverId, assignedNode.id);
        });
        
        // Log distribution
        const nodeStats = new Map();
        realNodes.forEach(node => {
            nodeStats.set(node.id, { name: node.name, count: 0, servers: [] });
        });
        
        mapping.forEach((nodeId, serverId) => {
            const server = servers.find(s => s.serverId === serverId);
            if (server && nodeStats.has(nodeId)) {
                const stats = nodeStats.get(nodeId);
                stats.count++;
                stats.servers.push(server.tag);
            }
        });
        
        sessionLogger.info('RebootScheduler', 'Server distribution across nodes:');
        nodeStats.forEach((stats, nodeId) => {
            sessionLogger.info('RebootScheduler', `  ${stats.name}: ${stats.count} servers (${stats.servers.join(', ')})`);
        });
        
        return mapping;
    },

    /**
     * Calculate optimal batching strategy based on available nodes
     * @param {Array} realNodes Array of node objects
     * @param {number} totalServers Total number of servers to reboot
     * @param {object} config Runtime configuration
     * @returns {object} Batching configuration
     */
    calculateOptimalBatching: function (realNodes, totalServers, config = this.defaultConfig) {
        if (config.batchingStrategy === "fixed") {
            // Use fixed batch size from config
            return {
                strategy: "fixed",
                batchSize: config.maxBatchSize,
                totalBatches: Math.ceil(totalServers / config.maxBatchSize)
            };
        }
        
        // Auto strategy: Calculate based on node capacity
        const maxPerNode = config.maxConcurrentReboots;
        const totalCapacity = realNodes.length * maxPerNode;
        
        // Calculate optimal batch size
        let optimalBatchSize;
        if (totalServers <= totalCapacity) {
            // All servers fit in one batch
            optimalBatchSize = totalServers;
        } else {
            // Use full node capacity per batch
            optimalBatchSize = totalCapacity;
        }
        
        const totalBatches = Math.ceil(totalServers / optimalBatchSize);
        
        return {
            strategy: "auto",
            batchSize: optimalBatchSize,
            totalBatches: totalBatches,
            nodesUsed: realNodes.length,
            maxPerNode: maxPerNode,
            totalCapacity: totalCapacity
        };
    },

    /**
     * Group servers by node with real node mapping
     * @param {Array} servers Array of server objects
     * @param {Map} serverNodeMapping Server to node mapping
     * @returns {Map} Map of nodeId to servers array
     */
    groupServersByNode: function (servers, serverNodeMapping = null) {
        const serversByNode = new Map();
        
        for (const server of servers) {
            // Use real node mapping if available, otherwise fallback
            const nodeId = serverNodeMapping ? 
                serverNodeMapping.get(server.serverId) || 'node-fallback' :
                server.nodeId || `node-${server.tag?.charAt(0) || 'default'}`;
            
            if (!serversByNode.has(nodeId)) {
                serversByNode.set(nodeId, []);
            }
            serversByNode.get(nodeId).push(server);
        }
        
        return serversByNode;
    },

    /**
     * Process all servers on a single node in parallel
     * @param {string} nodeId Node identifier
     * @param {Array} servers Array of servers for this node
     * @param {object} config Runtime configuration
     */
    processNodeBatch: async function (nodeId, servers, config = this.defaultConfig) {
        const maxConcurrent = config.maxConcurrentReboots;
        
        if (servers.length <= maxConcurrent) {
            // All servers fit within node capacity - process simultaneously
            sessionLogger.info('RebootScheduler', `Node ${nodeId}: Starting ${servers.length} servers SIMULTANEOUSLY (within capacity ${maxConcurrent})`);
            
            const serverPromises = servers.map(server => {
                sessionLogger.info('RebootScheduler', `Starting ${server.name} on ${nodeId}`);
                return this.executeFullServerReboot(server, nodeId);
            });
            
            const serverResults = await Promise.allSettled(serverPromises);
            
            // Process individual server results
            let successfulServers = 0;
            let failedServers = 0;
            
            serverResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successfulServers++;
                } else {
                    failedServers++;
                    const serverName = servers[index]?.name || `Server ${index + 1}`;
                    sessionLogger.error('RebootScheduler', `[${serverName}] Failed:`, result.reason?.message || result.reason);
                }
            });
            
            sessionLogger.info('RebootScheduler', `Node ${nodeId}: ${successfulServers} servers successful, ${failedServers} servers failed`);
        } else {
            // Too many servers - process in sub-batches
            sessionLogger.info('RebootScheduler', `Node ${nodeId}: Processing ${servers.length} servers in sub-batches of ${maxConcurrent}`);
            
            for (let i = 0; i < servers.length; i += maxConcurrent) {
                const subBatch = servers.slice(i, i + maxConcurrent);
                sessionLogger.info('RebootScheduler', `Node ${nodeId}: Sub-batch ${Math.floor(i/maxConcurrent) + 1} - ${subBatch.length} servers`);
                
                const subBatchPromises = subBatch.map(server => {
                    sessionLogger.info('RebootScheduler', `Starting ${server.name} on ${nodeId}`);
                    return this.executeFullServerReboot(server, nodeId);
                });
                
                const subBatchResults = await Promise.allSettled(subBatchPromises);
                
                // Process sub-batch results
                let subBatchSuccess = 0;
                let subBatchFailed = 0;
                
                subBatchResults.forEach((result, subIndex) => {
                    if (result.status === 'fulfilled') {
                        subBatchSuccess++;
                    } else {
                        subBatchFailed++;
                        const serverName = subBatch[subIndex]?.name || `Server ${subIndex + 1}`;
                        sessionLogger.error('RebootScheduler', `[${serverName}] Sub-batch failed:`, result.reason?.message || result.reason);
                    }
                });
                
                sessionLogger.info('RebootScheduler', `Node ${nodeId}: Sub-batch completed - ${subBatchSuccess} success, ${subBatchFailed} failed`);
                
                // Brief pause between sub-batches on same node
                if (i + maxConcurrent < servers.length) {
                    await functions.sleep(5000); // 5 second pause
                }
            }
            
            sessionLogger.info('RebootScheduler', `Node ${nodeId}: All ${servers.length} servers completed`);
        }
    },

    /**
     * Execute complete reboot for a single server (warnings + reboot + startup)
     * @param {object} server Server object
     * @param {string} nodeId Node ID
     * @returns {Promise} Promise that resolves when server reboot is complete
     */
    executeFullServerReboot: async function (server, nodeId) {
        // PREVENT DUPLICATE SERVER REBOOTS
        if (this.state.activeReboots.has(server.serverId)) {
            sessionLogger.warn('RebootScheduler', `[${server.name}] Already rebooting, skipping duplicate request`);
            return;
        }
        
        sessionLogger.info('RebootScheduler', `[${server.name}] Starting full reboot sequence`);
        
        // Track this reboot
        this.state.activeReboots.set(server.serverId, {
            server: server,
            nodeId: nodeId,
            attempts: 1,
            startTime: Date.now(),
            stage: 'warnings',
            warningStep: 0
        });
        
        try {
            // Execute warning sequence (includes server stop)
            await this.executeRebootWarnings(server);
            
            // Start server and monitor startup
            await this.startServerAndMonitor(server);
            
            sessionLogger.info('RebootScheduler', `[${server.name}] Reboot completed successfully`);
            await this.completeServerReboot(server, true);
            
        } catch (error) {
            sessionLogger.error('RebootScheduler', `[${server.name}] Reboot failed:`, error.message);
            await this.handleRebootFailure(server);
        }
    },

    /**
     * Execute the reboot warning sequence
     * @param {object} server Server object
     */
    executeRebootWarnings: async function (server) {
        // Keep original 15-minute warning sequence for proper player notification
        const warnings = [
            { command: 'say SCHEDULED REBOOT INCOMING NEXT 15 MINUTES. This process is automated. If problems appear, please ping alp in discord', delay: 300000 },
            { command: 'say SCHEDULED REBOOT INCOMING NEXT 10 MINUTES. This process is automated. If problems appear, please ping alp in discord', delay: 300000 },
            { command: 'say SCHEDULED REBOOT INCOMING NEXT 5 MINUTES. This process is automated. If problems appear, please ping alp in discord', delay: 120000 },
            { command: 'say SCHEDULED REBOOT INCOMING NEXT 3 MINUTES. This process is automated. If problems appear, please ping alp in discord', delay: 120000 },
            { command: 'say SCHEDULED REBOOT INCOMING NEXT ONE MINUTE. This process is automated. If problems appear, please ping alp in discord', delay: 45000 },
            { command: 'say SCHEDULED REBOOT INCOMING NEXT 15 SECONDS. FINAL SAY', delay: 15000 },
            { command: 'save-all', delay: 45000 },
            { command: 'stop', delay: 60000 }
        ];
        
        for (let i = 0; i < warnings.length; i++) {
            try {
                // Add timeout protection for each command
                const commandTimeout = setTimeout(() => {
                    throw new Error(`Command timeout: ${warnings[i].command}`);
                }, 15000); // 15 second timeout per command
                
                try {
                    await pterodactyl.sendCommand(server.serverId, warnings[i].command);
                    clearTimeout(commandTimeout);
                } catch (cmdError) {
                    clearTimeout(commandTimeout);
                    throw cmdError;
                }
                
                // Update stage tracking
                const rebootInfo = this.state.activeReboots.get(server.serverId);
                if (rebootInfo) {
                    rebootInfo.warningStep = i + 1;
                }
                
                // Wait for the specified delay (except for the last command)
                if (i < warnings.length - 1) {
                    await functions.sleep(warnings[i].delay);
                }
            } catch (error) {
                sessionLogger.error('RebootScheduler', `Error sending command to ${server.name}:`, error.message);
                // Continue with other commands even if one fails
            }
        }
        
        // After stop command, wait for clean shutdown
        await functions.sleep(60000); // Wait 1 minute after stop for clean shutdown
    },

    /**
     * Start server and monitor startup
     * @param {object} server Server object
     */
    startServerAndMonitor: async function (server) {
        try {
            // Start the server with timeout protection
            const startTimeout = setTimeout(() => {
                throw new Error(`Start command timeout after 30 seconds`);
            }, 30000);
            
            try {
                await pterodactyl.sendPowerAction(server.serverId, 'start');
                clearTimeout(startTimeout);
            } catch (startError) {
                clearTimeout(startTimeout);
                throw startError;
            }
            
            // Update stage
            const rebootInfo = this.state.activeReboots.get(server.serverId);
            if (rebootInfo) {
                rebootInfo.stage = 'starting';
                rebootInfo.startupStartTime = Date.now();
            }
            
            // Monitor startup with timeout and return success status
            const success = await this.monitorServerStartup(server);
            
            if (!success) {
                throw new Error('Server startup monitoring failed');
            }
            
            // SUCCESS - let executeFullServerReboot handle completion
            return true;
            
        } catch (error) {
            sessionLogger.error('RebootScheduler', `Error starting server ${server.name}:`, error.message);
            throw error; // Re-throw to let executeFullServerReboot handle it
        }
    },

    /**
     * Monitor server startup with timeout
     * @param {object} server Server object
     * @returns {boolean} Success status
     */
    monitorServerStartup: async function (server) {
        const timeout = 20 * 60 * 1000; // 20 minutes
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const status = await pterodactyl.getStatus(server.serverId);
                
                if (status.attributes.current_state === 'running') {
                    // Server is running, consider it successful
                    return true;
                }
                
                // Wait 30 seconds before next check
                await functions.sleep(30000);
                
            } catch (error) {
                sessionLogger.error('RebootScheduler', `Error checking status for ${server.name}:`, error.message);
            }
        }
        
        return false; // Timeout reached
    },

    /**
     * Complete server reboot (success)
     * @param {object} server Server object
     * @param {boolean} success Success status
     */
    completeServerReboot: async function (server, success) {
        const rebootInfo = this.state.activeReboots.get(server.serverId);
        
        // Ensure todayStats and retryAttempts exist
        if (!this.state.todayStats) {
            this.state.todayStats = { successfulReboots: 0, failedReboots: 0, retryAttempts: {} };
        }
        if (!this.state.todayStats.retryAttempts) {
            this.state.todayStats.retryAttempts = {};
        }
        
        if (success) {
            sessionLogger.info('RebootScheduler', `Successfully rebooted ${server.name}`);
            this.state.todayStats.successfulReboots++;
        } else {
            sessionLogger.warn('RebootScheduler', `Failed to reboot ${server.name}`);
            this.state.todayStats.failedReboots++;
        }
        
        // Track retry attempts safely
        if (rebootInfo && rebootInfo.attempts) {
            try {
                this.state.todayStats.retryAttempts[server.serverId] = rebootInfo.attempts;
            } catch (error) {
                sessionLogger.error('RebootScheduler', `Error tracking retry attempts for ${server.name}:`, error.message);
            }
        }
        
        // Remove from active reboots
        this.state.activeReboots.delete(server.serverId);
    },

    /**
     * Handle reboot failure with retry logic and circuit breaker protection
     * @param {object} server Server object
     */
    handleRebootFailure: async function (server) {
        const rebootInfo = this.state.activeReboots.get(server.serverId);
        
        if (!rebootInfo) return;
        
        rebootInfo.attempts++;
        
        // Circuit breaker: prevent infinite recursion
        const maxRetries = this.runtimeConfig?.rebootRetryLimit || 3;
        const timeSinceStart = Date.now() - rebootInfo.startTime;
        const maxRebootTime = 45 * 60 * 1000; // 45 minutes absolute maximum
        
        // Check circuit breaker conditions
        if (rebootInfo.attempts >= maxRetries) {
            sessionLogger.warn('RebootScheduler', `Circuit breaker: Max retries (${maxRetries}) reached for ${server.name}`);
            await this.alertStaffServerFailure(server);
            await this.completeServerReboot(server, false);
            return;
        }
        
        if (timeSinceStart > maxRebootTime) {
            sessionLogger.warn('RebootScheduler', `Circuit breaker: Max reboot time (45min) exceeded for ${server.name}`);
            await this.alertStaffServerFailure(server);
            await this.completeServerReboot(server, false);
            return;
        }
        
        if (rebootInfo.attempts < maxRetries) {
            sessionLogger.info('RebootScheduler', `Retrying reboot for ${server.name} (attempt ${rebootInfo.attempts + 1})`);
            
            try {
                // Kill the server first with timeout protection
                const killTimeout = setTimeout(() => {
                    throw new Error(`Kill command timeout after 30 seconds`);
                }, 30000);
                
                try {
                    await pterodactyl.sendPowerAction(server.serverId, 'kill');
                    clearTimeout(killTimeout);
                } catch (killError) {
                    clearTimeout(killTimeout);
                    sessionLogger.error('RebootScheduler', `Kill command failed for ${server.name}:`, killError.message);
                    // Continue anyway - server might already be down
                }
                
                await functions.sleep(10000); // Wait 10 seconds
                
                // Try starting again
                await this.startServerAndMonitor(server);
            } catch (error) {
                sessionLogger.error('RebootScheduler', `Error during retry for ${server.name}:`, error.message);
                // Prevent infinite recursion - circuit breaker will handle it
                await this.handleRebootFailure(server);
            }
        }
    },

    /**
     * Alert staff about server failure
     * @param {object} server Server object
     */
    alertStaffServerFailure: async function (server) {
        try {
            const { getClient } = require('../discord/bot');
            const client = await getClient();
            const channel = await client.channels.fetch('1358558826118381678');
            
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Server Reboot Failure')
                .setDescription(`Server **${server.name}** (ID: ${server.serverId}, Tag: ${server.tag}) failed to reboot after 3 attempts.`)
                .addFields(
                    { name: 'Server ID', value: server.serverId, inline: true },
                    { name: 'Server Tag', value: server.tag.toUpperCase(), inline: true },
                    { name: 'Action Required', value: 'Manual intervention needed', inline: false }
                )
                .setTimestamp();
            
            await channel.send({ embeds: [embed] });
            
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error alerting staff:', error.message);
        }
    },

    /**
     * Complete the entire reboot sequence
     */
    completeRebootSequence: async function () {
        sessionLogger.info('RebootScheduler', 'Reboot sequence completed');
        
        this.state.isRebootInProgress = false;
        this.state.todayStats.rebootCompleted = true;
        this.state.todayStats.rebootEndTime = new Date().toISOString();
        
        const totalTime = Date.now() - this.state.rebootStartTime;
        this.state.todayStats.totalDuration = totalTime;
        
        // Save final stats with error handling
        try {
            await mongo.updateRebootHistory(timeManager.getTodayDateString(), this.state.todayStats);
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error saving final reboot stats:', error.message);
            // Log but continue - stats are important but not critical for completion
        }
        
        // Send completion notification with error handling
        try {
            await this.sendRebootNotification('complete', {
                successCount: this.state.todayStats.successfulReboots,
                failureCount: this.state.todayStats.failedReboots,
                totalTime: timeManager.formatDuration(totalTime),
                retryAttempts: this.state.todayStats.retryAttempts
            });
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error sending completion notification:', error.message);
            // Log but don't fail - notification is nice-to-have
        }
    },

    /**
     * Recover from interrupted reboot process on scheduler restart
     */
    recoverFromInterruptedReboot: async function () {
        try {
            const today = timeManager.getTodayDateString();
            const todayStats = await mongo.getRebootHistory(today);
            
            if (todayStats && todayStats.rebootTriggered && !todayStats.rebootCompleted) {
                sessionLogger.info('RebootScheduler', '🔄 Detected interrupted reboot process - performing recovery...');
                
                // Clear any stuck state
                this.state.isRebootInProgress = false;
                this.state.rebootQueue = [];
                this.state.activeReboots.clear();
                
                // Mark as completed with partial success
                todayStats.rebootCompleted = true;
                todayStats.rebootEndTime = new Date().toISOString();
                todayStats.notes = 'Recovered from interrupted process on scheduler restart';
                
                // Save recovery state
                await mongo.updateRebootHistory(today, todayStats);
                
                sessionLogger.info('RebootScheduler', '✅ State recovery completed - scheduler ready for new operations');
            }
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error during state recovery:', error.message);
            // Continue anyway - don't let recovery failures block the scheduler
        }
    },

    /**
     * Emergency cleanup function - can be called manually if needed
     */
    emergencyCleanup: async function () {
        sessionLogger.warn('RebootScheduler', '🚨 Performing emergency cleanup...');
        
        try {
            // Clear all active state
            this.state.isRebootInProgress = false;
            this.state.rebootQueue = [];
            this.state.activeReboots.clear();
            
            // Reset today's stats if needed
            if (this.state.todayStats.rebootTriggered && !this.state.todayStats.rebootCompleted) {
                this.state.todayStats.rebootCompleted = true;
                this.state.todayStats.rebootEndTime = new Date().toISOString();
                this.state.todayStats.notes = 'Emergency cleanup performed';
                
                const today = timeManager.getTodayDateString();
                await mongo.updateRebootHistory(today, this.state.todayStats);
            }
            
            sessionLogger.info('RebootScheduler', '✅ Emergency cleanup completed');
            return true;
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error during emergency cleanup:', error.message);
            return false;
        }
    },

    /**
     * Abort current reboot sequence safely
     */
    abortRebootSequence: async function (reason = 'Manual abort') {
        if (!this.state.isRebootInProgress) {
            sessionLogger.info('RebootScheduler', 'No reboot in progress to abort');
            return false;
        }
        
        sessionLogger.warn('RebootScheduler', `🛑 Aborting reboot sequence: ${reason}`);
        
        try {
            // Mark current process as completed
            this.state.isRebootInProgress = false;
            this.state.todayStats.rebootCompleted = true;
            this.state.todayStats.rebootEndTime = new Date().toISOString();
            this.state.todayStats.notes = `Aborted: ${reason}`;
            
            // Save abort state
            const today = timeManager.getTodayDateString();
            await mongo.updateRebootHistory(today, this.state.todayStats);
            
            // Clear queues and active reboots
            this.state.rebootQueue = [];
            this.state.activeReboots.clear();
            
            sessionLogger.info('RebootScheduler', '✅ Reboot sequence aborted successfully');
            return true;
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error aborting reboot sequence:', error.message);
            return false;
        }
    },

    /**
     * Send reboot notification to staff channel
     * @param {string} type Notification type ('start', 'complete', 'failure')
     * @param {object} data Notification data
     */
    sendRebootNotification: async function (type, data) {
        try {
            const { getClient } = require('../discord/bot');
            const client = await getClient();
            const channel = await client.channels.fetch('1358558826118381678');
            
            let embed;
            
            if (type === 'start') {
                embed = new EmbedBuilder()
                    .setColor(0xffa500)
                    .setTitle('Automated Reboot Sequence Started')
                    .setDescription(`Starting reboot of ${data.serverCount} servers`)
                    .addFields(
                        { name: 'Trigger Reason', value: data.reason, inline: false },
                        { name: 'Player Count', value: data.playerCount.toString(), inline: true },
                        { name: 'Server Count', value: data.serverCount.toString(), inline: true },
                        { name: 'Started At', value: timeManager.getCurrentTimeGMT3().toISOString(), inline: true }
                    )
                    .setTimestamp();
                    
            } else if (type === 'complete') {
                const retryDetails = Object.keys(data.retryAttempts).length > 0 
                    ? Object.entries(data.retryAttempts).map(([id, attempts]) => `${id}: ${attempts} attempts`).join('\n')
                    : 'None';
                
                embed = new EmbedBuilder()
                    .setColor(data.failureCount > 0 ? 0xffa500 : 0x00ff00)
                    .setTitle('Automated Reboot Sequence Completed')
                    .addFields(
                        { name: 'Successful Reboots', value: data.successCount.toString(), inline: true },
                        { name: 'Failed Reboots', value: data.failureCount.toString(), inline: true },
                        { name: 'Total Duration', value: data.totalTime, inline: true },
                        { name: 'Retry Details', value: retryDetails, inline: false }
                    )
                    .setTimestamp();
            }
            
            if (embed) {
                await channel.send({ embeds: [embed] });
            }
            
        } catch (error) {
            sessionLogger.error('RebootScheduler', 'Error sending reboot notification:', error.message);
        }
    }
};