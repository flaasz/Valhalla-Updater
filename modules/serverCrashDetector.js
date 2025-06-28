const pterodactyl = require('./pterodactyl');
const sessionLogger = require('./sessionLogger');

/**
 * Server crash detection system with state transition tracking
 * Monitors Pterodactyl servers for crash patterns and loops
 */
class ServerCrashDetector {
    constructor() {
        // Server state tracking
        this.serverStates = new Map(); // serverId -> current state info
        this.stateHistory = new Map(); // serverId -> array of state transitions
        this.crashHistory = new Map(); // serverId -> array of crash events
        
        // Load configuration from config.json
        this.loadConfig();
        
        this.initializeDetector();
    }
    
    loadConfig() {
        try {
            const configData = require('../config/config.json');
            const crashConfig = configData.crashMonitoring || {};
            const detectionConfig = crashConfig.crashDetection || {};
            
            // Apply configuration with defaults
            this.config = {
                // How long to track state history (in minutes, converted to ms)
                historyRetentionTime: (detectionConfig.historyRetentionTime || 30) * 60 * 1000,
                
                // Crash loop detection thresholds
                crashLoopThreshold: detectionConfig.crashLoopThreshold || 3,
                crashLoopTimeWindow: (detectionConfig.crashLoopTimeWindow || 10) * 60 * 1000,
                
                // State transition timeouts (in minutes, converted to ms)
                startingTimeout: (detectionConfig.startingTimeout || 15) * 60 * 1000,
                stoppingTimeout: (detectionConfig.stoppingTimeout || 3) * 60 * 1000,
                
                // Minimum uptime before considering next stop a "crash" (in minutes, converted to ms)
                minimumUptimeBeforeCrash: (detectionConfig.minimumUptimeBeforeCrash || 2) * 60 * 1000,
                
                // Overall system active flag
                active: crashConfig.active !== false
            };
            
            sessionLogger.info('ServerCrashDetector', 'Configuration loaded from config.json');
            
        } catch (err) {
            // Fallback to defaults if config loading fails
            this.config = {
                historyRetentionTime: 30 * 60 * 1000,
                crashLoopThreshold: 3,
                crashLoopTimeWindow: 10 * 60 * 1000,
                startingTimeout: 15 * 60 * 1000,
                stoppingTimeout: 3 * 60 * 1000,
                minimumUptimeBeforeCrash: 2 * 60 * 1000,
                active: true
            };
            
            sessionLogger.warn('ServerCrashDetector', 'Failed to load config, using defaults:', err.message);
        }
    }
    
    initializeDetector() {
        try {
            sessionLogger.info('ServerCrashDetector', 'Server crash detector initialized');
            
            // Clean up old history every 5 minutes
            setInterval(() => {
                this.cleanupOldHistory();
            }, 5 * 60 * 1000);
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Initialization failed:', err.message);
        }
    }
    
    /**
     * Process server state update from the status monitor
     * @param {object} server - Server configuration object
     * @param {boolean} isOnline - Whether server is currently online (in shardList)
     */
    async processServerUpdate(server, isOnline) {
        try {
            if (!server || !server.serverId) {
                return;
            }
            
            // Get detailed status from Pterodactyl
            const pteroStatus = await this.getPterodactylStatus(server.serverId);
            if (!pteroStatus) {
                return; // Skip if we can't get status
            }
            
            const currentState = pteroStatus.current_state;
            const timestamp = Date.now();
            
            // Get previous state
            const previousStateInfo = this.serverStates.get(server.serverId);
            const previousState = previousStateInfo ? previousStateInfo.state : null;
            
            // Only process if state actually changed
            if (previousState === currentState) {
                return;
            }
            
            // Update current state
            const stateInfo = {
                state: currentState,
                timestamp: timestamp,
                isOnline: isOnline,
                serverName: server.name,
                serverTag: server.tag,
                uptime: pteroStatus.uptime || 0
            };
            this.serverStates.set(server.serverId, stateInfo);
            
            // Add to state history
            await this.addStateTransition(server.serverId, {
                fromState: previousState,
                toState: currentState,
                timestamp: timestamp,
                serverName: server.name,
                serverTag: server.tag,
                uptime: pteroStatus.uptime || 0
            });
            
            // Analyze for crashes
            await this.analyzeStateTransition(server.serverId, previousState, currentState, stateInfo);
            
            sessionLogger.debug('ServerCrashDetector', `${server.tag}: ${previousState || 'unknown'} → ${currentState}`);
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', `Error processing server update for ${server.tag}:`, err.message);
        }
    }
    
    /**
     * Get detailed status from Pterodactyl API
     */
    async getPterodactylStatus(serverId) {
        try {
            const status = await pterodactyl.getStatus(serverId);
            if (!status || !status.attributes) {
                return null;
            }
            
            const attributes = status.attributes;
            return {
                current_state: attributes.current_state,
                uptime: attributes.resources?.uptime || 0,
                memory: attributes.resources?.memory_bytes || 0,
                cpu: attributes.resources?.cpu_absolute || 0
            };
            
        } catch (err) {
            sessionLogger.warn('ServerCrashDetector', `Failed to get Pterodactyl status for ${serverId}:`, err.message);
            return null;
        }
    }
    
    /**
     * Add state transition to history
     */
    async addStateTransition(serverId, transition) {
        try {
            if (!this.stateHistory.has(serverId)) {
                this.stateHistory.set(serverId, []);
            }
            
            const history = this.stateHistory.get(serverId);
            history.push(transition);
            
            // Keep only recent history
            const cutoff = Date.now() - this.config.historyRetentionTime;
            const recentHistory = history.filter(t => t.timestamp > cutoff);
            this.stateHistory.set(serverId, recentHistory);
            
            // Save state transition to MongoDB for persistent storage
            try {
                const mongo = require('./mongo');
                await mongo.storeStateTransition(serverId, transition);
            } catch (mongoErr) {
                sessionLogger.warn('ServerCrashDetector', 'Failed to store state transition to MongoDB:', mongoErr.message);
            }
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error adding state transition:', err.message);
        }
    }
    
    /**
     * Analyze state transition for crash patterns
     */
    async analyzeStateTransition(serverId, fromState, toState, stateInfo) {
        try {
            // Detect potential crash: running -> offline (and it wasn't a graceful stop)
            if (fromState === 'running' && toState === 'offline') {
                await this.handlePotentialCrash(serverId, stateInfo);
            }
            
            // Detect rapid restart cycle: offline -> starting
            if (fromState === 'offline' && toState === 'starting') {
                await this.checkForCrashLoop(serverId, stateInfo);
            }
            
            // Detect stuck in starting state
            if (toState === 'starting') {
                this.scheduleStartingTimeout(serverId, stateInfo);
            }
            
            // Server successfully started after crash
            if (fromState === 'starting' && toState === 'running') {
                await this.handleSuccessfulRestart(serverId, stateInfo);
            }
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error analyzing state transition:', err.message);
        }
    }
    
    /**
     * Handle potential server crash (running -> offline)
     */
    async handlePotentialCrash(serverId, stateInfo) {
        try {
            const history = this.stateHistory.get(serverId) || [];
            
            // Find the last time this server started running
            const lastRunningStart = history
                .slice()
                .reverse()
                .find(t => t.toState === 'running');
                
            if (!lastRunningStart) {
                return; // No previous running state found
            }
            
            const uptime = stateInfo.timestamp - lastRunningStart.timestamp;
            
            // If server was running for less than minimum uptime, consider it a crash
            const isCrash = uptime < this.config.minimumUptimeBeforeCrash;
            
            if (isCrash) {
                await this.recordCrashEvent(serverId, {
                    type: 'unexpected_stop',
                    timestamp: stateInfo.timestamp,
                    uptime: uptime,
                    serverName: stateInfo.serverName,
                    serverTag: stateInfo.serverTag,
                    previousState: 'running'
                });
                
                sessionLogger.warn('ServerCrashDetector', `Crash detected: ${stateInfo.serverTag} (uptime: ${Math.round(uptime / 1000)}s)`);
            }
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error handling potential crash:', err.message);
        }
    }
    
    /**
     * Check for crash loop pattern
     */
    async checkForCrashLoop(serverId, stateInfo) {
        try {
            const crashes = this.crashHistory.get(serverId) || [];
            const recentCrashes = crashes.filter(
                crash => stateInfo.timestamp - crash.timestamp < this.config.crashLoopTimeWindow
            );
            
            if (recentCrashes.length >= this.config.crashLoopThreshold) {
                await this.handleCrashLoop(serverId, stateInfo, recentCrashes);
            }
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error checking crash loop:', err.message);
        }
    }
    
    /**
     * Handle detected crash loop
     */
    async handleCrashLoop(serverId, stateInfo, recentCrashes) {
        try {
            sessionLogger.error('ServerCrashDetector', `Crash loop detected: ${stateInfo.serverTag} (${recentCrashes.length} crashes)`);
            
            // Send Discord notification for crash loop
            const { sendServerCrash } = require('./crashNotificationManager');
            await sendServerCrash({
                serverId: serverId,
                name: stateInfo.serverName,
                tag: stateInfo.serverTag,
                crashType: 'crash_loop',
                status: 'crash_loop_detected',
                crashCount: recentCrashes.length,
                timeWindow: Math.round(this.config.crashLoopTimeWindow / 60000),
                lastSeen: recentCrashes[recentCrashes.length - 1].timestamp,
                action: 'Staff has been notified. Automatic restart may be disabled.'
            });
            
            // Record crash loop event
            await this.recordCrashEvent(serverId, {
                type: 'crash_loop',
                timestamp: stateInfo.timestamp,
                crashCount: recentCrashes.length,
                serverName: stateInfo.serverName,
                serverTag: stateInfo.serverTag,
                timeWindow: this.config.crashLoopTimeWindow
            });
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error handling crash loop:', err.message);
        }
    }
    
    /**
     * Handle successful restart after crash
     */
    async handleSuccessfulRestart(serverId, stateInfo) {
        try {
            const crashes = this.crashHistory.get(serverId) || [];
            const recentCrashes = crashes.filter(
                crash => stateInfo.timestamp - crash.timestamp < this.config.crashLoopTimeWindow
            );
            
            if (recentCrashes.length > 0) {
                sessionLogger.info('ServerCrashDetector', `${stateInfo.serverTag} successfully restarted after crash(es)`);
                
                // If there were multiple recent crashes, send a recovery notification
                if (recentCrashes.length >= 2) {
                    const { sendServerCrash } = require('./crashNotificationManager');
                    await sendServerCrash({
                        serverId: serverId,
                        name: stateInfo.serverName,
                        tag: stateInfo.serverTag,
                        crashType: 'recovery',
                        status: 'recovered',
                        crashCount: recentCrashes.length,
                        action: `Server has recovered and is now online. Had ${recentCrashes.length} crashes recently.`
                    });
                }
            }
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error handling successful restart:', err.message);
        }
    }
    
    /**
     * Schedule timeout check for servers stuck in starting state
     */
    scheduleStartingTimeout(serverId, stateInfo) {
        try {
            setTimeout(async () => {
                try {
                    const currentState = this.serverStates.get(serverId);
                    
                    // If still starting after timeout, consider it a failed start
                    if (currentState && currentState.state === 'starting' && 
                        currentState.timestamp === stateInfo.timestamp) {
                        
                        sessionLogger.warn('ServerCrashDetector', `${stateInfo.serverTag} stuck in starting state`);
                        
                        await this.recordCrashEvent(serverId, {
                            type: 'failed_start',
                            timestamp: Date.now(),
                            serverName: stateInfo.serverName,
                            serverTag: stateInfo.serverTag,
                            stuckDuration: this.config.startingTimeout
                        });
                        
                        const { sendServerCrash } = require('./crashNotificationManager');
                        await sendServerCrash({
                            serverId: serverId,
                            name: stateInfo.serverName,
                            tag: stateInfo.serverTag,
                            crashType: 'failed_start',
                            status: 'stuck_starting',
                            action: 'Server is stuck in starting state. Manual intervention may be required.'
                        });
                    }
                } catch (err) {
                    sessionLogger.error('ServerCrashDetector', 'Error in starting timeout check:', err.message);
                }
            }, this.config.startingTimeout);
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error scheduling starting timeout:', err.message);
        }
    }
    
    /**
     * Record crash event to history
     */
    async recordCrashEvent(serverId, crashEvent) {
        try {
            if (!this.crashHistory.has(serverId)) {
                this.crashHistory.set(serverId, []);
            }
            
            const history = this.crashHistory.get(serverId);
            history.push(crashEvent);
            
            // Keep only recent crash history
            const cutoff = Date.now() - this.config.historyRetentionTime;
            const recentHistory = history.filter(crash => crash.timestamp > cutoff);
            this.crashHistory.set(serverId, recentHistory);
            
            // Save to MongoDB for persistent storage
            try {
                const mongo = require('./mongo');
                await mongo.storeCrashEvent(serverId, crashEvent);
            } catch (mongoErr) {
                sessionLogger.warn('ServerCrashDetector', 'Failed to store crash event to MongoDB:', mongoErr.message);
            }
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error recording crash event:', err.message);
        }
    }
    
    /**
     * Clean up old history data
     */
    cleanupOldHistory() {
        try {
            const cutoff = Date.now() - this.config.historyRetentionTime;
            
            // Clean state history
            for (const [serverId, history] of this.stateHistory.entries()) {
                const recentHistory = history.filter(t => t.timestamp > cutoff);
                if (recentHistory.length === 0) {
                    this.stateHistory.delete(serverId);
                } else {
                    this.stateHistory.set(serverId, recentHistory);
                }
            }
            
            // Clean crash history
            for (const [serverId, crashes] of this.crashHistory.entries()) {
                const recentCrashes = crashes.filter(crash => crash.timestamp > cutoff);
                if (recentCrashes.length === 0) {
                    this.crashHistory.delete(serverId);
                } else {
                    this.crashHistory.set(serverId, recentCrashes);
                }
            }
            
            sessionLogger.debug('ServerCrashDetector', 'Cleaned up old history data');
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error cleaning up history:', err.message);
        }
    }
    
    /**
     * Get current server status for display
     */
    getServerStatus(serverId) {
        try {
            const stateInfo = this.serverStates.get(serverId);
            const crashes = this.crashHistory.get(serverId) || [];
            const recentCrashes = crashes.filter(
                crash => Date.now() - crash.timestamp < this.config.crashLoopTimeWindow
            );
            
            return {
                currentState: stateInfo ? stateInfo.state : 'unknown',
                isOnline: stateInfo ? stateInfo.isOnline : false,
                lastUpdate: stateInfo ? stateInfo.timestamp : null,
                recentCrashes: recentCrashes.length,
                lastCrash: crashes.length > 0 ? crashes[crashes.length - 1] : null,
                statusText: this.generateStatusText(stateInfo, recentCrashes)
            };
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error getting server status:', err.message);
            return null;
        }
    }
    
    /**
     * Generate status text for server embed display
     */
    generateStatusText(stateInfo, recentCrashes) {
        try {
            if (!stateInfo) {
                return '';
            }
            
            // Server is restarting after crash
            if (stateInfo.state === 'starting' && recentCrashes.length > 0) {
                return ' (CRASHED, starting back!)';
            }
            
            // Server is in crash loop
            if (recentCrashes.length >= this.config.crashLoopThreshold) {
                return ' (CRASH LOOP!)';
            }
            
            // Server recently crashed but is now online
            if (stateInfo.state === 'running' && recentCrashes.length > 0) {
                const timeSinceLastCrash = Date.now() - recentCrashes[recentCrashes.length - 1].timestamp;
                if (timeSinceLastCrash < 5 * 60 * 1000) { // 5 minutes
                    return ' (recently crashed)';
                }
            }
            
            return '';
            
        } catch (err) {
            return '';
        }
    }
    
    /**
     * Get crash statistics
     */
    getStats() {
        try {
            const totalServers = this.serverStates.size;
            const totalCrashes = Array.from(this.crashHistory.values())
                .reduce((sum, crashes) => sum + crashes.length, 0);
            
            const serversWithRecentCrashes = Array.from(this.crashHistory.entries())
                .filter(([serverId, crashes]) => {
                    const recentCrashes = crashes.filter(
                        crash => Date.now() - crash.timestamp < this.config.crashLoopTimeWindow
                    );
                    return recentCrashes.length > 0;
                }).length;
            
            return {
                totalServers,
                totalCrashes,
                serversWithRecentCrashes,
                memoryUsage: {
                    stateHistory: this.stateHistory.size,
                    crashHistory: this.crashHistory.size
                }
            };
            
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error getting stats:', err.message);
            return null;
        }
    }
}

// Singleton instance
let crashDetector = null;

module.exports = {
    /**
     * Get the crash detector instance (singleton)
     */
    getCrashDetector() {
        try {
            if (!crashDetector) {
                crashDetector = new ServerCrashDetector();
            }
            return crashDetector;
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Failed to create crash detector:', err.message);
            return null;
        }
    },
    
    /**
     * Quick access function for server status
     */
    getServerStatus(serverId) {
        const detector = module.exports.getCrashDetector();
        return detector ? detector.getServerStatus(serverId) : null;
    },
    
    /**
     * Quick access function for processing server updates
     */
    async processServerUpdate(server, isOnline) {
        try {
            const detector = module.exports.getCrashDetector();
            if (detector) {
                await detector.processServerUpdate(server, isOnline);
            }
        } catch (err) {
            sessionLogger.error('ServerCrashDetector', 'Error in processServerUpdate:', err.message);
        }
    }
};