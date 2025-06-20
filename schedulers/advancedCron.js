const mongo = require("../modules/mongo");
const velocityMetrics = require("../modules/velocityMetrics");
const pterodactyl = require("../modules/pterodactyl");
const timeManager = require("../modules/timeManager");
const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: 'advancedCron',
    defaultConfig: {
        "active": true,
        "interval": 30, // Check every 30 seconds (player triggers need responsiveness)
        "rebootCheckInterval": 300, // Check for reboots every 5 minutes (300 seconds)
        "rebootCheckEnabled": true,
        "playerTriggerEnabled": true,
        "maxConcurrentReboots": 4,
        "rebootRetryLimit": 3,
        "serverStartupTimeout": 20, // Minutes
        "batchingStrategy": "auto", // "auto" = dynamic based on nodes, "fixed" = use maxBatchSize
        "maxBatchSize": 12 // Only used if batchingStrategy is "fixed"
    },

    // Internal state tracking
    state: {
        isRebootInProgress: false,
        rebootStartTime: null,
        rebootQueue: [],
        activeReboots: new Map(), // serverId -> { attempts, startTime, nodeId }
        playerTriggers: new Map(), // playerId -> { commands, servers }
        lastRebootCheck: 0, // Timestamp of last reboot check
        todayStats: {
            lowestPlayerCount: null,
            lowestPlayerTime: null,
            rebootTriggered: false,
            rebootCompleted: false
        }
    },

    /**
     * Starts the advanced cron scheduler
     * @param {object} options Configuration options
     */
    start: async function (options) {
        console.log(`Advanced Cron started - checking every ${options.interval} seconds`);
        
        // FIXED: Store runtime config for use throughout the module
        this.runtimeConfig = options;
        
        // Initialize today's stats
        await this.initializeTodayStats();
        
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
            
            // Check for player-triggered commands
            if (options.playerTriggerEnabled) {
                await this.checkPlayerTriggers();
            }
            
            // Check for reboot scheduling - Only check every rebootCheckInterval
            const now = Date.now();
            const rebootCheckInterval = (options.rebootCheckInterval || 300) * 1000; // Convert to ms
            
            if (options.rebootCheckEnabled && 
                !this.state.isRebootInProgress && 
                !this.state.todayStats.rebootCompleted &&
                (now - this.state.lastRebootCheck) > rebootCheckInterval) {
                
                this.state.lastRebootCheck = now;
                await this.checkRebootSchedule();
            }
            
            // Note: Active reboot monitoring is now handled within executeFullServerReboot
            
        } catch (error) {
            console.error('Error in advancedCron.mainLoop:', error.message);
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
            
            // Update lowest player count if in reboot window
            if (timeWindow.isInWindow) {
                if (this.state.todayStats.lowestPlayerCount === null || totalPlayers < this.state.todayStats.lowestPlayerCount) {
                    this.state.todayStats.lowestPlayerCount = totalPlayers;
                    this.state.todayStats.lowestPlayerTime = currentTime.toISOString();
                    
                    // Save to database
                    await mongo.updateRebootHistory(timeManager.getTodayDateString(), this.state.todayStats);
                }
            }
            
        } catch (error) {
            console.error('Error updating player stats:', error.message);
        }
    },

    /**
     * Check for player-triggered commands
     */
    checkPlayerTriggers: async function () {
        try {
            const playersData = await velocityMetrics.getPlayers();
            const activeTriggers = await mongo.getActiveCronJobs('player_trigger');
            
            
            for (const trigger of activeTriggers) {
                const { playerId, serverNames, commands, onJoin, lastSeenServers = [] } = trigger;
                
                // Track current servers where player is online
                const currentServers = [];
                for (const serverName of serverNames) {
                    if (playersData[serverName] && playersData[serverName].includes(playerId)) {
                        currentServers.push(serverName);
                    }
                }
                
                
                const wasOnline = lastSeenServers.length > 0;
                const isOnline = currentServers.length > 0;
                
                if (isOnline) {
                    if (onJoin) {
                        // OnJoin mode: execute EVERY time player goes from offline → online
                        if (!wasOnline) {
                            // Player just came online - execute trigger
                            for (const serverName of currentServers) {
                                await this.executePlayerTrigger(trigger, serverName);
                                break; // Only execute once per join
                            }
                        }
                        // If player was already online, don't execute (not a new join)
                    } else {
                        // Normal mode: execute continuously while online (every check)
                        for (const serverName of currentServers) {
                            await this.executePlayerTrigger(trigger, serverName);
                            break; // Only execute once per check cycle
                        }
                    }
                }
                
                // Update last seen servers for this trigger  
                if (JSON.stringify(currentServers.sort()) !== JSON.stringify(lastSeenServers.sort())) {
                    await mongo.updateCronJob(trigger._id, { lastSeenServers: currentServers });
                }
            }
            
        } catch (error) {
            console.error('Error in player triggers:', error.message);
        }
    },

    /**
     * Execute commands for player trigger
     * @param {object} trigger Trigger configuration
     * @param {string} serverName Server where player was found
     */
    executePlayerTrigger: async function (trigger, serverName) {
        try {
            const servers = await mongo.getServers();
            // FIX: Trim server names to handle trailing spaces in database
            const server = servers.find(s => s.name.trim() === serverName.trim());
            
            if (!server) return;
            
            // Execute each command
            for (const command of trigger.commands) {
                console.log(`Player trigger: '${command}' executed for ${trigger.playerId} on ${server.tag}`);
                await pterodactyl.sendCommand(server.serverId, command);
                await this.sleep(1000); // 1 second delay between commands
            }
            
            // Mark trigger as executed (if it's one-time)
            if (trigger.oneTime) {
                await mongo.deactivateCronJob(trigger._id);
            }
            
        } catch (error) {
            console.error('Error executing player trigger:', error.message);
        }
    },

    /**
     * Check if reboot should be scheduled
     */
    checkRebootSchedule: async function () {
        try {
            const timeWindow = timeManager.checkRebootWindow();
            const playersData = await velocityMetrics.getPlayers();
            
            let totalPlayers = 0;
            for (const serverName in playersData) {
                totalPlayers += playersData[serverName].length;
            }
            
            // PREVENT DUPLICATE TRIGGERS - Only start if not already running
            if (this.state.isRebootInProgress) {
                console.log('Reboot already in progress, skipping trigger check');
                return;
            }
            
            // Simple trigger logic: reboot if less than 25 players
            let shouldTrigger = false;
            let triggerReason = '';
            
            if (totalPlayers < 25) {
                shouldTrigger = true;
                triggerReason = `Low player count (${totalPlayers} < 25)`;
            }
            
            if (shouldTrigger) {
                await this.triggerRebootSequence(triggerReason, totalPlayers);
            }
            
        } catch (error) {
            console.error('Error checking reboot schedule:', error.message);
        }
    },

    /**
     * Analyze player count trend over last few checks
     * @returns {object} Trend analysis
     */
    analyzePlayerTrend: async function () {
        // This would ideally look at recent player count history
        // For now, return a simple analysis
        return {
            isDecreasing: true, // Simplified for initial implementation
            isStable: false,
            isIncreasing: false
        };
    },

    /**
     * Trigger the complete reboot sequence
     * @param {string} reason Reason for triggering
     * @param {number} currentPlayerCount Current player count
     */
    triggerRebootSequence: async function (reason, currentPlayerCount) {
        console.log(`Triggering reboot sequence: ${reason}`);
        
        this.state.isRebootInProgress = true;
        this.state.rebootStartTime = Date.now();
        this.state.todayStats.rebootTriggered = true;
        this.state.todayStats.rebootStartTime = new Date().toISOString();
        this.state.todayStats.triggerReason = reason;
        this.state.todayStats.triggerPlayerCount = currentPlayerCount;
        
        // Get all servers that need rebooting
        const servers = await mongo.getServers();
        
        // DEBUG: Log all servers and their exclusion status
        console.log(`Total servers found: ${servers.length}`);
        servers.forEach(server => {
            const excluded = server.excludeFromServerList;
            const earlyAccess = server.early_access;
            const shouldReboot = this.shouldRebootServer(server);
            console.log(`Server ${server.tag}: excludeFromServerList=${excluded}, early_access=${earlyAccess}, shouldReboot=${shouldReboot}`);
        });
        
        const eligibleServers = servers.filter(server => 
            !server.early_access &&
            this.shouldRebootServer(server)
        );
        
        console.log(`Eligible servers for reboot: ${eligibleServers.map(s => s.tag).join(', ')}`);
        
        // Check for missing GTSE/GTNG specifically
        const gtseServer = servers.find(s => s.tag === 'GTSE');
        const gtngServer = servers.find(s => s.tag === 'GTNG');
        if (gtseServer) console.log(`GTSE status: excludeFromServerList=${gtseServer.excludeFromServerList}, early_access=${gtseServer.early_access}`);
        if (gtngServer) console.log(`GTNG status: excludeFromServerList=${gtngServer.excludeFromServerList}, early_access=${gtngServer.early_access}`);
        
        this.state.todayStats.totalServers = eligibleServers.length;
        this.state.rebootQueue = [...eligibleServers];
        
        // Save initial stats
        await mongo.updateRebootHistory(timeManager.getTodayDateString(), this.state.todayStats);
        
        // Send notification to staff channel
        await this.sendRebootNotification('start', { reason, playerCount: currentPlayerCount, serverCount: eligibleServers.length });
        
        // Start processing the queue
        await this.processRebootQueue(this.runtimeConfig || this.defaultConfig);
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
            console.log(`Excluding ${server.tag}: in excludedTags list`);
            return false;
        }
        
        // DEBUG: Check for any other exclusion reasons
        if (server.tag === 'GTSE' || server.tag === 'GTNG') {
            console.log(`${server.tag}: Passed shouldRebootServer check`);
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
        console.log(`Starting PARALLEL reboot of ${this.state.rebootQueue.length} servers`);
        
        // Discover real node infrastructure
        const realNodes = await this.discoverRealNodes();
        
        // Map servers to real nodes
        const serverNodeMapping = await this.mapServersToRealNodes(this.state.rebootQueue, realNodes);
        
        // DYNAMIC BATCHING - Calculate optimal batch size automatically
        const batchConfig = this.calculateOptimalBatching(realNodes, this.state.rebootQueue.length, config);
        
        console.log(`Processing ${this.state.rebootQueue.length} servers in ${batchConfig.totalBatches} dynamic batches`);
        console.log(`Batch strategy: ${batchConfig.strategy}, Max per batch: ${batchConfig.batchSize}`);
        
        for (let batchIndex = 0; batchIndex < batchConfig.totalBatches; batchIndex++) {
            const batchStart = batchIndex * batchConfig.batchSize;
            const batchEnd = Math.min(batchStart + batchConfig.batchSize, this.state.rebootQueue.length);
            const currentBatch = this.state.rebootQueue.slice(batchStart, batchEnd);
            
            console.log(`BATCH ${batchIndex + 1}/${batchConfig.totalBatches}: Processing ${currentBatch.length} servers SIMULTANEOUSLY`);
            
            // Group current batch by nodes (4 servers per node max)
            const batchByNode = this.groupServersByNode(currentBatch, serverNodeMapping);
            
            // Start ALL nodes in parallel - THIS IS THE FIX!
            const nodePromises = [];
            for (const [nodeId, servers] of batchByNode.entries()) {
                console.log(`Node ${nodeId}: Starting ${servers.length} servers in parallel`);
                const nodePromise = this.processNodeBatch(nodeId, servers, config);
                nodePromises.push(nodePromise);
            }
            
            // Wait for ALL nodes to complete simultaneously
            try {
                await Promise.all(nodePromises);
                console.log(`BATCH ${batchIndex + 1} COMPLETED: All ${currentBatch.length} servers finished`);
            } catch (error) {
                console.error(`Error in batch ${batchIndex + 1}:`, error.message);
            }
            
            // Brief delay between batches for stability
            if (batchIndex + 1 < batchConfig.totalBatches) {
                console.log(`Cooling down 30 seconds before next batch...`);
                await this.sleep(30000);
            }
        }
        
        console.log('ALL SERVERS PROCESSED - MASSIVE PERFORMANCE IMPROVEMENT ACHIEVED!');
        await this.completeRebootSequence();
    },

    /**
     * Discover REAL Pterodactyl node infrastructure via API
     * Replaces fake "node-x" assignments with actual node discovery
     */
    discoverRealNodes: async function () {
        try {
            console.log('Discovering real Pterodactyl nodes...');
            const realNodes = await pterodactyl.getNodes();
            
            if (realNodes && realNodes.length > 0) {
                console.log(`Discovered ${realNodes.length} real nodes:`);
                realNodes.forEach(node => {
                    const memUsage = ((node.memory.allocated / node.memory.total) * 100).toFixed(1);
                    const diskUsage = ((node.disk.allocated / node.disk.total) * 100).toFixed(1);
                    console.log(`  ${node.name} (${node.fqdn}): RAM ${memUsage}%, Disk ${diskUsage}%`);
                });
                return realNodes;
            } else {
                throw new Error('No nodes returned from API');
            }
        } catch (error) {
            console.error('Error discovering real nodes, using fallback:', error.message);
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
        
        console.log('Mapping servers to nodes with round-robin distribution...');
        
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
        
        console.log('Server distribution across nodes:');
        nodeStats.forEach((stats, nodeId) => {
            console.log(`  ${stats.name}: ${stats.count} servers (${stats.servers.join(', ')})`);
        });
        
        return mapping;
    },

    /**
     * Calculate optimal batching strategy based on available nodes
     * @param {Array} realNodes Array of node objects
     * @param {number} totalServers Total number of servers to reboot
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
     */
    processNodeBatch: async function (nodeId, servers, config = this.defaultConfig) {
        const maxConcurrent = config.maxConcurrentReboots;
        
        if (servers.length <= maxConcurrent) {
            // All servers fit within node capacity - process simultaneously
            console.log(`Node ${nodeId}: Starting ${servers.length} servers SIMULTANEOUSLY (within capacity ${maxConcurrent})`);
            
            const serverPromises = servers.map(server => {
                console.log(`Starting ${server.name} on ${nodeId}`);
                return this.executeFullServerReboot(server, nodeId);
            });
            
            try {
                await Promise.all(serverPromises);
                console.log(`Node ${nodeId}: All ${servers.length} servers completed successfully`);
            } catch (error) {
                console.error(`Node ${nodeId}: Error processing servers:`, error.message);
                throw error;
            }
        } else {
            // Too many servers - process in sub-batches
            console.log(`Node ${nodeId}: Processing ${servers.length} servers in sub-batches of ${maxConcurrent}`);
            
            for (let i = 0; i < servers.length; i += maxConcurrent) {
                const subBatch = servers.slice(i, i + maxConcurrent);
                console.log(`Node ${nodeId}: Sub-batch ${Math.floor(i/maxConcurrent) + 1} - ${subBatch.length} servers`);
                
                const subBatchPromises = subBatch.map(server => {
                    console.log(`Starting ${server.name} on ${nodeId}`);
                    return this.executeFullServerReboot(server, nodeId);
                });
                
                try {
                    await Promise.all(subBatchPromises);
                    console.log(`Node ${nodeId}: Sub-batch completed`);
                } catch (error) {
                    console.error(`Node ${nodeId}: Sub-batch error:`, error.message);
                }
                
                // Brief pause between sub-batches on same node
                if (i + maxConcurrent < servers.length) {
                    await this.sleep(5000); // 5 second pause
                }
            }
            
            console.log(`Node ${nodeId}: All ${servers.length} servers completed`);
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
            console.log(`[${server.name}] Already rebooting, skipping duplicate request`);
            return;
        }
        
        console.log(`[${server.name}] Starting full reboot sequence`);
        
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
            
            console.log(`[${server.name}] Reboot completed successfully`);
            await this.completeServerReboot(server, true);
            
        } catch (error) {
            console.error(`[${server.name}] Reboot failed:`, error.message);
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
                await pterodactyl.sendCommand(server.serverId, warnings[i].command);
                
                // Update stage tracking
                const rebootInfo = this.state.activeReboots.get(server.serverId);
                if (rebootInfo) {
                    rebootInfo.warningStep = i + 1;
                }
                
                // Wait for the specified delay (except for the last command)
                if (i < warnings.length - 1) {
                    await this.sleep(warnings[i].delay);
                }
            } catch (error) {
                console.error(`Error sending command to ${server.name}:`, error.message);
            }
        }
        
        // After stop command, wait for clean shutdown
        await this.sleep(60000); // Wait 1 minute after stop for clean shutdown
    },

    /**
     * Start server and monitor startup
     * @param {object} server Server object
     */
    startServerAndMonitor: async function (server) {
        try {
            // Start the server
            await pterodactyl.sendPowerAction(server.serverId, 'start');
            
            // Update stage
            const rebootInfo = this.state.activeReboots.get(server.serverId);
            if (rebootInfo) {
                rebootInfo.stage = 'starting';
                rebootInfo.startupStartTime = Date.now();
            }
            
            // Monitor startup with timeout
            const success = await this.monitorServerStartup(server);
            
            if (success) {
                await this.completeServerReboot(server, true);
            } else {
                await this.handleRebootFailure(server);
            }
            
        } catch (error) {
            console.error(`Error starting server ${server.name}:`, error.message);
            await this.handleRebootFailure(server);
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
                await this.sleep(30000);
                
            } catch (error) {
                console.error(`Error checking status for ${server.name}:`, error.message);
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
        
        if (success) {
            console.log(`Successfully rebooted ${server.name}`);
            this.state.todayStats.successfulReboots++;
        } else {
            console.log(`Failed to reboot ${server.name}`);
            this.state.todayStats.failedReboots++;
        }
        
        // Track retry attempts
        if (rebootInfo) {
            this.state.todayStats.retryAttempts[server.serverId] = rebootInfo.attempts;
        }
        
        // Remove from active reboots
        this.state.activeReboots.delete(server.serverId);
        
        // Note: completeRebootSequence is now called from processRebootQueue when all batches are done
    },

    /**
     * Handle reboot failure with retry logic
     * @param {object} server Server object
     */
    handleRebootFailure: async function (server) {
        const rebootInfo = this.state.activeReboots.get(server.serverId);
        
        if (!rebootInfo) return;
        
        rebootInfo.attempts++;
        
        if (rebootInfo.attempts < 3) {
            console.log(`Retrying reboot for ${server.name} (attempt ${rebootInfo.attempts + 1})`);
            
            try {
                // Kill the server first
                await pterodactyl.sendPowerAction(server.serverId, 'kill');
                await this.sleep(10000); // Wait 10 seconds
                
                // Try starting again
                await this.startServerAndMonitor(server);
            } catch (error) {
                console.error(`Error during retry for ${server.name}:`, error.message);
                await this.handleRebootFailure(server); // Recursive retry
            }
        } else {
            // Max retries reached, notify staff and mark as failed
            console.log(`Max retries reached for ${server.name}, alerting staff`);
            await this.alertStaffServerFailure(server);
            await this.completeServerReboot(server, false);
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
            console.error('Error alerting staff:', error.message);
        }
    },

    /**
     * Complete the entire reboot sequence
     */
    completeRebootSequence: async function () {
        console.log('Reboot sequence completed');
        
        this.state.isRebootInProgress = false;
        this.state.todayStats.rebootCompleted = true;
        this.state.todayStats.rebootEndTime = new Date().toISOString();
        
        const totalTime = Date.now() - this.state.rebootStartTime;
        this.state.todayStats.totalDuration = totalTime;
        
        // Save final stats
        await mongo.updateRebootHistory(timeManager.getTodayDateString(), this.state.todayStats);
        
        // Send completion notification
        await this.sendRebootNotification('complete', {
            successCount: this.state.todayStats.successfulReboots,
            failureCount: this.state.todayStats.failedReboots,
            totalTime: timeManager.formatDuration(totalTime),
            retryAttempts: this.state.todayStats.retryAttempts
        });
    },

    /**
     * Monitor active reboots for timeouts and issues
     * @param {object} options Configuration options
     */
    monitorActiveReboots: async function (options) {
        const now = Date.now();
        const timeout = options.serverStartupTimeout * 60 * 1000;
        
        for (const [serverId, rebootInfo] of this.state.activeReboots) {
            if (rebootInfo.stage === 'starting' && rebootInfo.startupStartTime) {
                const elapsed = now - rebootInfo.startupStartTime;
                
                if (elapsed > timeout) {
                    console.log(`Server ${rebootInfo.server.name} startup timeout, handling failure`);
                    await this.handleRebootFailure(rebootInfo.server);
                }
            }
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
            console.error('Error sending reboot notification:', error.message);
        }
    },

    /**
     * Utility sleep function
     * @param {number} ms Milliseconds to sleep
     */
    sleep: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};