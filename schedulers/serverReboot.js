const pterodactyl = require('../modules/pterodactyl');
const mongo = require('../modules/mongo');

module.exports = {
    name: "serverReboot",
    defaultConfig: {
        "active": true,
        "minUptime": 3600, // 1 hour in seconds
        "maxUptime": 86400, // 24 hours in seconds
        "maxOnline": 10,
        "minTPS": 15,
        "maxCPUUsage": 700, // 7 threads
        "checkInterval": 300, // 5 minutes in seconds
        "whitelistedServers": [], // Array of serverIDs with special reboot rules
        "whitelistedChecks": {
            "skipTPS": true,
            "checkUptime": true,
            "checkOnline": true,
            "checkCPUUsage": true,
            "checkCPUSpike": true
        },
        "rebootMessages": [
            { time: 900, message: "§6[Server] §eServer reboot in 15 minutes", type: "chat" },
            { time: 600, message: "§6[Server] §eServer reboot in 10 minutes", type: "chat" },
            { time: 300, message: "§6[Server] §eServer reboot in 5 minutes", type: "chat" },
            { time: 180, message: "§6[Server] §eServer reboot in 3 minutes", type: "chat" },
            { time: 60, message: "§c§lServer reboot in 1 minute", type: "title" },
            { time: 30, message: "§c§lServer reboot in 30 seconds", type: "title" },
            { time: 10, message: "§c§lServer reboot in 10 seconds", type: "title" },
            { time: 5, message: "§c§lReboot imminent!", type: "title" }
        ],
        "nodeCores": {
            "88.198.57.57": 16,
            "144.76.74.85": 32
        },
        "maxCPUPercentage": 80, // Maximum CPU percentage to allow reboots
        "cpuSpikeThreshold": 7, // 700% spike
        "cpuSpikeWindow": 300, // 5 minutes in seconds
        "startupGracePeriod": 600, // 10 minutes in seconds
        "lowVersionThreshold": "1.12.2", // Versions below this are considered "low"
        "lowVersionMaxReboots": 8, // Maximum simultaneous reboots for low versions
        "rebootCooldown": 3600, // 1 hour cooldown between reboots for the same server
    },

    rebootQueue: [],
    currentReboots: 0,
    rebootHistory: {},

    start: async function (options) {
        setInterval(() => this.checkServers(options), options.checkInterval * 1000);
        setInterval(() => this.processRebootQueue(options), 60000); // Check queue every minute
        setInterval(() => this.cleanupRebootHistory(), 86400000); // Clean up history daily
    },

    cleanupRebootHistory: function () {
        const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
        Object.keys(this.rebootHistory).forEach(serverId => {
            this.rebootHistory[serverId] = this.rebootHistory[serverId].filter(reboot => reboot.timestamp > cutoffTime);
        });
    },

    checkServers: async function (options) {
        const servers = await mongo.getServers();
        for (const server of servers) {
            await this.checkServer(server, options);
        }
    },

    checkServer: async function (server, options) {
        const isWhitelisted = options.whitelistedServers.includes(server.serverId);
        const whitelistedChecks = options.whitelistedChecks;

        const status = await pterodactyl.getStatus(server.serverId);
        const uptime = status.attributes.resources.uptime;
        const online = server.players;
        const tps = server.tps;
        const cpuUsage = status.attributes.resources.cpu_absolute;

        // Skip checks during startup grace period
        if (uptime < options.startupGracePeriod) return;

        let shouldReboot = false;

        if (!isWhitelisted || whitelistedChecks.checkUptime) {
            if (uptime > options.maxUptime) {
                shouldReboot = true;
            }
        }

        if (!isWhitelisted || whitelistedChecks.checkOnline) {
            if (online <= options.maxOnline) {
                if (!isWhitelisted || !whitelistedChecks.skipTPS) {
                    if (tps <= options.minTPS) {
                        shouldReboot = true;
                    }
                } else {
                    shouldReboot = true;
                }
            }
        }

        if (!isWhitelisted || whitelistedChecks.checkCPUUsage) {
            if (cpuUsage > options.maxCPUUsage) {
                shouldReboot = true;
            }
        }

        if (shouldReboot) {
            this.queueReboot(server, options, "Scheduled reboot");
        }

        // Check for CPU usage spike
        if (!isWhitelisted || whitelistedChecks.checkCPUSpike) {
            await this.checkCPUSpike(server, cpuUsage, options);
        }
    },

    checkCPUSpike: async function (server, currentCPU, options) {
        const cpuHistory = await mongo.getCPUHistory(server.serverId);
        cpuHistory.push({ timestamp: Date.now(), cpu: currentCPU });
        
        if (cpuHistory.length > 10) {
            cpuHistory.shift();
        }

        await mongo.updateCPUHistory(server.serverId, cpuHistory);

        const windowStart = Date.now() - options.cpuSpikeWindow * 1000;
        const recentCPU = cpuHistory.filter(entry => entry.timestamp > windowStart);

        if (recentCPU.length > 1) {
            const avgCPU = recentCPU.reduce((sum, entry) => sum + entry.cpu, 0) / recentCPU.length;
            const maxCPU = Math.max(...recentCPU.map(entry => entry.cpu));
            if (maxCPU / avgCPU > options.cpuSpikeThreshold) {
                this.queueReboot(server, options, "CPU spike detected");
            }
        }
    },

    queueReboot: function (server, options, reason) {
        const priority = this.calculatePriority(server);
        const rebootId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        this.rebootQueue.push({ id: rebootId, server, options, priority, reason, queuedAt: Date.now() });
        this.rebootQueue.sort((a, b) => b.priority - a.priority);
        return rebootId;
    },

    cancelReboot: function (rebootId) {
        const index = this.rebootQueue.findIndex(reboot => reboot.id === rebootId);
        if (index !== -1) {
            const cancelledReboot = this.rebootQueue[index];
            if (cancelledReboot.inProgress) {
                // If the reboot is in progress, we need to stop it
                this.stopReboot(cancelledReboot.server.serverId);
                this.currentReboots[cancelledReboot.server.ip.split(':')[0]]--;
            }
            this.rebootQueue.splice(index, 1);
            return { success: true, message: `Cancelled reboot for server ${cancelledReboot.server.name}` };
        }
        return { success: false, message: 'Reboot not found in queue' };
    },

    stopReboot: async function (serverId) {
        console.log(`Stopping in-progress reboot for server ${serverId}`);
        
        // Cancel any scheduled reboot messages
        clearTimeout(this.rebootMessageTimeouts[serverId]);
        
        // Send a message to the server that the reboot has been cancelled
        await pterodactyl.sendCommand(serverId, `tellraw @a {"text":"[Server] Scheduled reboot has been cancelled.","color":"green"}`);
        
        // If the server is in the process of stopping, start it again
        const status = await pterodactyl.getStatus(serverId);
        if (status.attributes.current_state === "stopping") {
            await pterodactyl.sendPowerAction(serverId, "start");
        }
        
        // Remove the server from the reboot queue if it's there
        this.rebootQueue = this.rebootQueue.filter(reboot => reboot.server.serverId !== serverId);
        
        // Reset the reboot flag for this server
        this.currentReboots[serverId.split(':')[0]]--;
        
        console.log(`Reboot stopped for server ${serverId}`);
    },

    getQueueStatus: function () {
        return this.rebootQueue.map(reboot => ({
            id: reboot.id,
            serverName: reboot.server.name,
            reason: reboot.reason,
            queuedAt: new Date(reboot.queuedAt).toISOString(),
            priority: reboot.priority
        }));
    },

    calculatePriority: function (server) {
        // Higher priority for newer Minecraft versions
        const versionPriority = parseInt(server.server_version.split('.')[1]) || 0;
        return versionPriority;
    },

    processRebootQueue: async function (options) {
        const ipGroups = {};
        this.rebootQueue.forEach(reboot => {
            const ip = reboot.server.ip.split(':')[0];
            if (!ipGroups[ip]) ipGroups[ip] = [];
            ipGroups[ip].push(reboot);
        });

        for (const ip in ipGroups) {
            const currentCPUUsage = await this.getCurrentCPUUsage(ip);
            const totalCores = options.nodeCores[ip] * 100; // Convert cores to percentage
            const availableCPU = totalCores - currentCPUUsage;
            const maxRebootsBasedOnCPU = Math.floor(availableCPU / 300); // Assuming each reboot uses about 300% CPU

            const currentReboots = this.currentReboots[ip] || 0;
            let availableSlots = Math.min(maxRebootsBasedOnCPU, options.lowVersionMaxReboots) - currentReboots;

            for (let i = 0; i < availableSlots && ipGroups[ip].length > 0; i++) {
                const reboot = ipGroups[ip][0];
                const { server, options: serverOptions, reason } = reboot;
                
                if (await this.canRebootServer(server, options)) {
                    this.currentReboots[ip] = (this.currentReboots[ip] || 0) + 1;
                    this.initiateReboot(server, serverOptions, reason);
                    // Mark the reboot as in progress instead of removing it from the queue
                    reboot.inProgress = true;
                }
                // Move this server to the end of the queue regardless of whether it was rebooted
                ipGroups[ip].push(ipGroups[ip].shift());
            }
        }

        // Update the reboot queue, removing only completed reboots
        this.rebootQueue = Object.values(ipGroups).flat().filter(reboot => !reboot.inProgress);
    },

    getCurrentCPUUsage: async function (ip) {
        const servers = await mongo.getServers();
        const nodeServers = servers.filter(server => server.ip.split(':')[0] === ip);
        let totalCPUUsage = 0;

        for (const server of nodeServers) {
            const status = await pterodactyl.getStatus(server.serverId);
            totalCPUUsage += status.attributes.resources.cpu_absolute;
        }

        const totalCores = this.defaultConfig.nodeCores[ip] * 100; // Convert cores to percentage
        const cpuPercentage = (totalCPUUsage / totalCores) * 100;

        return cpuPercentage;
    },

    canRebootServer: async function (server, options) {
        const rebootHistory = this.rebootHistory[server.serverId] || [];
        const lastReboot = rebootHistory[rebootHistory.length - 1];

        if (lastReboot && (Date.now() - lastReboot.timestamp) < options.rebootCooldown * 1000) {
            return false; // Server was rebooted recently
        }

        const status = await pterodactyl.getStatus(server.serverId);
        const currentState = status.attributes.current_state;
        const uptime = status.attributes.resources.uptime;
        const online = server.players;
        const tps = server.tps;
        const cpuUsage = status.attributes.resources.cpu_absolute;

        if (currentState !== "running") {
            return false; // Server is not in a running state
        }

        // Ignore core usage if uptime and CPU usage are extremely high
        if (uptime > options.maxUptime * 2 && cpuUsage > options.maxCPUUsage * 2) {
            return true;
        }

        if (uptime > options.maxUptime || 
            (online <= options.maxOnline && tps <= options.minTPS) || 
            cpuUsage > options.maxCPUUsage) {
            return true;
        }

        return false;
    },

    isLowVersion: function (version, threshold) {
        const versionParts = version.split('.');
        const thresholdParts = threshold.split('.');
        
        for (let i = 0; i < Math.min(versionParts.length, thresholdParts.length); i++) {
            if (parseInt(versionParts[i]) < parseInt(thresholdParts[i])) {
                return true;
            } else if (parseInt(versionParts[i]) > parseInt(thresholdParts[i])) {
                return false;
            }
        }
        
        return versionParts.length < thresholdParts.length;
    },

    initiateReboot: async function (server, options, reason) {
        console.log(`Initiating reboot for server ${server.serverId} (${server.name}). Reason: ${reason}`);
        const startTime = Date.now();

        const isLowVersion = this.isLowVersion(server.server_version, options.lowVersionThreshold);

        for (const msg of options.rebootMessages) {
            if (msg.type === 'chat') {
                await pterodactyl.sendCommand(server.serverId, `tellraw @a {"text":"${msg.message}","color":"yellow"}`);
            } else if (msg.type === 'title') {
                if (isLowVersion) {
                    // For older versions, use /say command instead of title
                    await pterodactyl.sendCommand(server.serverId, `say ${msg.message}`);
                } else {
                    await pterodactyl.sendCommand(server.serverId, `title @a times 20 60 20`);
                    await pterodactyl.sendCommand(server.serverId, `title @a title {"text":"${msg.message}","color":"red","bold":true}`);
                }
            }
            await new Promise(resolve => setTimeout(resolve, msg.time * 1000));
        }

        await pterodactyl.sendCommand(server.serverId, 'save-all');
        await new Promise(resolve => setTimeout(resolve, 45000));
        await pterodactyl.sendCommand(server.serverId, 'stop');
        
        // Wait for server to stop, then kill if necessary
        await new Promise(resolve => setTimeout(resolve, 60000));
        const status = await pterodactyl.getStatus(server.serverId);
        if (status.attributes.current_state !== "offline") {
            await pterodactyl.sendPowerAction(server.serverId, "kill");
        }

        // Start the server
        await new Promise(resolve => setTimeout(resolve, 30000));
        await pterodactyl.sendPowerAction(server.serverId, "start");

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Log reboot statistics
        await mongo.logReboot(server.serverId, reason, duration);

        // Update local reboot history
        if (!this.rebootHistory[server.serverId]) {
            this.rebootHistory[server.serverId] = [];
        }
        this.rebootHistory[server.serverId].push({ timestamp: endTime, reason, duration });

        const ip = server.ip.split(':')[0];
        this.currentReboots[ip]--;

        // Return reboot statistics
        return await mongo.getRebootStats(server.serverId);
    },

    getRebootStats: function (serverId) {
        const serverHistory = this.rebootHistory[serverId] || [];
        const totalReboots = serverHistory.length;
        const lastReboot = serverHistory[serverHistory.length - 1];
        const averageDuration = serverHistory.reduce((sum, reboot) => sum + reboot.duration, 0) / totalReboots;

        return {
            totalReboots,
            lastReboot,
            averageDuration,
            rebootFrequency: totalReboots / (30 * 24 * 60 * 60 * 1000) * 1000 * 60 * 60 * 24 // Reboots per day
        };
    }
};
