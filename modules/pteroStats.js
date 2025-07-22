require('dotenv').config();
const {
    pterosocket
} = require('pterosocket');
const { pterodactylHostName } = require('../config/config.json');
const sessionLogger = require('./sessionLogger');

module.exports = class PteroStats {
    constructor() {
        this.cpu_absolute = 0;
        this.disk_bytes = 0;
        this.memory_bytes = 0;
        this.memory_limit_bytes = 0;
        this.network = {
            rx_bytes: 0,
            tx_bytes: 0
        };
        this.state = "offline";
        this.uptime = 0;
        this.socket = null;
        this.serverId = null;
        this.connectionError = null;
        this.lastUpdate = null;
    }

    /**
     * Start monitoring a server
     * @param {string} serverId Server ID to monitor
     * @returns {boolean} Success status
     */
    start(serverId) {
        try {
            if (this.socket) {
                sessionLogger.warn('PteroStats', `Socket already exists for server ${serverId}, disconnecting first`);
                this.disconnect();
            }

            this.serverId = serverId;
            this.connectionError = null;
            
            // Create and store the socket instance
            this.socket = new pterosocket(
                pterodactylHostName.replace(/\/$/, ""),
                process.env.PTERODACTYL_APIKEY,
                serverId
            );

            // Set up event handlers
            this.socket.on("stats", (data) => {
                this.cpu_absolute = data.cpu_absolute;
                this.disk_bytes = data.disk_bytes;
                this.memory_bytes = data.memory_bytes;
                this.memory_limit_bytes = data.memory_limit_bytes;
                this.network = data.network;
                this.state = data.state;
                this.uptime = data.uptime;
                this.lastUpdate = Date.now();
            });

            this.socket.on("error", (error) => {
                this.connectionError = error.message;
                sessionLogger.error('PteroStats', `Socket error for server ${serverId}: ${error.message}`);
            });

            this.socket.on("disconnect", () => {
                sessionLogger.debug('PteroStats', `Socket disconnected for server ${serverId}`);
            });

            sessionLogger.debug('PteroStats', `Started monitoring for server ${serverId}`);
            return true;
        } catch (error) {
            this.connectionError = error.message;
            sessionLogger.error('PteroStats', `Failed to start monitoring for server ${serverId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Disconnect the socket and clean up resources
     */
    disconnect() {
        try {
            if (this.socket) {
                this.socket.disconnect();
                sessionLogger.debug('PteroStats', `Disconnected socket for server ${this.serverId}`);
            }
        } catch (error) {
            sessionLogger.error('PteroStats', `Error disconnecting socket for server ${this.serverId}: ${error.message}`);
        } finally {
            this.socket = null;
        }
    }

    /**
     * Get current server stats
     * @returns {Object} Server stats
     */
    getStats() {
        return {
            cpu_absolute: this.cpu_absolute,
            disk_bytes: this.disk_bytes,
            memory_bytes: this.memory_bytes,
            memory_limit_bytes: this.memory_limit_bytes,
            network: this.network,
            state: this.state,
            uptime: this.uptime,
            lastUpdate: this.lastUpdate,
            connectionError: this.connectionError,
            isConnected: !!this.socket
        };
    }

    /**
     * Check if the connection is healthy
     * @returns {boolean} Connection health status
     */
    isHealthy() {
        if (!this.socket) {
            return false;
        }
        
        if (this.connectionError) {
            return false;
        }
        
        // Check if we've received an update in the last 30 seconds
        if (this.lastUpdate) {
            const timeSinceUpdate = Date.now() - this.lastUpdate;
            return timeSinceUpdate < 30000; // 30 seconds
        }
        
        return false;
    }
};