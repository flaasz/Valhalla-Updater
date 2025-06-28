const { EmbedBuilder } = require('discord.js');
const sessionLogger = require('./sessionLogger');


class CrashNotificationManager {
    constructor() {
        // Load configuration from config.json
        this.loadConfig();
        
        // Rate limiting and deduplication
        this.lastNotifications = new Map();
        this.recentNotifications = new Map();
        
        // Circuit breaker to prevent notification floods
        this.circuitBreaker = {
            isOpen: false,
            failureCount: 0,
            lastFailure: 0,
            threshold: 5,
            resetTimeout: 300000 // 5 minutes
        };
        
        // Emergency fallback tracking
        this.emergencyMode = false;
        this.fallbackAttempts = 0;
        
        this.initializeNotificationManager();
    }
    
    loadConfig() {
        try {
            const configData = require('../config/config.json');
            const crashConfig = configData.crashMonitoring || {};
            const notificationConfig = crashConfig.notifications || {};
            
            // Channel configurations
            this.channels = {
                critical: notificationConfig.criticalCrashChannel || '1358558826118381678',
                server: notificationConfig.serverCrashChannel || '1245355510228844616'
            };
            
            // Rate limiting configuration
            this.rateLimitWindow = (notificationConfig.rateLimitWindow || 60) * 1000; // Convert to ms
            this.maxNotificationsPerWindow = notificationConfig.maxNotificationsPerWindow || 3;
            
            // System flags
            this.active = crashConfig.active !== false;
            this.notificationsEnabled = notificationConfig.enabled !== false;
            
            sessionLogger.info('CrashNotificationManager', 'Configuration loaded from config.json');
            
        } catch (err) {
            // Fallback to defaults if config loading fails
            this.channels = {
                critical: '1358558826118381678',
                server: '1245355510228844616'
            };
            this.rateLimitWindow = 60000;
            this.maxNotificationsPerWindow = 3;
            this.active = true;
            this.notificationsEnabled = true;
            
            sessionLogger.warn('CrashNotificationManager', 'Failed to load config, using defaults:', err.message);
        }
    }
    
    initializeNotificationManager() {
        try {
            sessionLogger.info('CrashNotificationManager', 'Crash notification manager initialized');
            
            // Clean up old notifications every 5 minutes
            setInterval(() => {
                this.cleanupOldNotifications();
            }, 300000);
            
        } catch (err) {
            // Even initialization errors cannot crash the system
            console.error('CrashNotificationManager initialization warning:', err.message);
        }
    }
    
    /**
     * Send critical application crash notification
     * @param {object} crashData - Crash information
     * @param {string} crashData.error - Error message
     * @param {string} crashData.stack - Stack trace
     * @param {object} crashData.systemInfo - System information
     * @param {string} crashData.severity - Crash severity (CRITICAL, HIGH, MEDIUM, LOW)
     */
    async sendCriticalCrashNotification(crashData) {
        try {
            // Check if system is active and notifications are enabled
            if (!this.active || !this.notificationsEnabled) {
                return;
            }
            
            // Only send CRITICAL and HIGH severity to critical channel
            if (!['CRITICAL', 'HIGH'].includes(crashData.severity)) {
                return;
            }
            
            const notificationKey = `critical_${this.hashCrashData(crashData)}`;
            
            if (this.shouldSuppressNotification(notificationKey)) {
                sessionLogger.warn('CrashNotificationManager', 'Critical crash notification suppressed due to rate limiting');
                return;
            }
            
            const embed = this.createCriticalCrashEmbed(crashData);
            await this.sendNotificationWithFallbacks('critical', embed, notificationKey);
            
        } catch (err) {
            // Critical crash notifications must never crash the system
            this.handleNotificationError('sendCriticalCrashNotification', err);
        }
    }
    
    /**
     * Send server crash notification
     * @param {object} serverData - Server crash information
     */
    async sendServerCrashNotification(serverData) {
        try {
            // Check if system is active and notifications are enabled
            if (!this.active || !this.notificationsEnabled) {
                return;
            }
            
            const notificationKey = `server_${serverData.serverId}_${serverData.crashType}`;
            
            if (this.shouldSuppressNotification(notificationKey)) {
                sessionLogger.warn('CrashNotificationManager', `Server crash notification suppressed: ${serverData.name}`);
                return;
            }
            
            const embed = this.createServerCrashEmbed(serverData);
            await this.sendNotificationWithFallbacks('server', embed, notificationKey);
            
        } catch (err) {
            // Server crash notifications must never crash the system
            this.handleNotificationError('sendServerCrashNotification', err);
        }
    }
    
    /**
     * Create rich embed for critical application crashes
     */
    createCriticalCrashEmbed(crashData) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🚨 CRITICAL APPLICATION CRASH')
                .setColor(0xFF0000)
                .setTimestamp()
                .addFields(
                    { name: '💥 Error Type', value: crashData.error?.name || 'Unknown', inline: true },
                    { name: '⚠️ Severity', value: crashData.severity, inline: true },
                    { name: '🖥️ System', value: `${crashData.systemInfo?.platform || 'unknown'} ${crashData.systemInfo?.nodeVersion || ''}`, inline: true }
                );
                
            // Add error message (truncated if too long)
            const errorMsg = crashData.error?.message || 'No error message available';
            embed.addFields({
                name: '📋 Error Message',
                value: this.truncateText(errorMsg, 1000)
            });
            
            // Add stack trace (truncated if too long)
            if (crashData.stack) {
                embed.addFields({
                    name: '📍 Stack Trace',
                    value: `\`\`\`\n${this.truncateText(crashData.stack, 800)}\n\`\`\``
                });
            }
            
            // Add memory info if available
            if (crashData.memoryInfo) {
                const memInfo = crashData.memoryInfo;
                embed.addFields({
                    name: '🧠 Memory Usage',
                    value: `Heap: ${Math.round(memInfo.heapUsed / 1024 / 1024)}MB / RSS: ${Math.round(memInfo.rss / 1024 / 1024)}MB`,
                    inline: true
                });
            }
            
            embed.setFooter({ text: 'Valhalla Updater Crash Reporter' });
            
            return embed;
            
        } catch (err) {
            // If embed creation fails, return a simple fallback
            return this.createFallbackEmbed('Critical crash detected but embed creation failed', 0xFF0000);
        }
    }
    
    /**
     * Create rich embed for server crashes
     */
    createServerCrashEmbed(serverData) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ SERVER CRASH DETECTED')
                .setColor(0xFF8C00)
                .setTimestamp()
                .addFields(
                    { name: '🖥️ Server', value: `**${serverData.name}** (${serverData.tag})`, inline: true },
                    { name: '📊 Crash Type', value: serverData.crashType || 'Unknown', inline: true },
                    { name: '🔄 Status', value: serverData.status || 'Unknown', inline: true }
                );
            
            if (serverData.crashCount) {
                embed.addFields({
                    name: '🔁 Crash Count',
                    value: `${serverData.crashCount} crashes in the last ${serverData.timeWindow || '10'} minutes`,
                    inline: true
                });
            }
            
            if (serverData.lastSeen) {
                embed.addFields({
                    name: '⏰ Last Online',
                    value: `<t:${Math.floor(serverData.lastSeen / 1000)}:R>`,
                    inline: true
                });
            }
            
            if (serverData.uptime) {
                embed.addFields({
                    name: '⏱️ Uptime Before Crash',
                    value: `${serverData.uptime} hours`,
                    inline: true
                });
            }
            
            // Add action taken
            const action = serverData.action || 'Staff has been notified. Server may restart automatically.';
            embed.addFields({
                name: '🛠️ Action Taken',
                value: action
            });
            
            embed.setFooter({ text: 'Valhalla Server Monitor' });
            
            return embed;
            
        } catch (err) {
            // If embed creation fails, return a simple fallback
            return this.createFallbackEmbed(`Server crash: ${serverData.name}`, 0xFF8C00);
        }
    }
    
    /**
     * Create fallback embed when rich embed creation fails
     */
    createFallbackEmbed(message, color) {
        try {
            return new EmbedBuilder()
                .setDescription(message)
                .setColor(color)
                .setTimestamp();
        } catch (err) {
            // If even fallback fails, return null and use text message
            return null;
        }
    }
    
    /**
     * Send notification with multiple fallback layers
     */
    async sendNotificationWithFallbacks(channelType, embed, notificationKey) {
        const maxRetries = 3;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Check circuit breaker
                if (this.circuitBreaker.isOpen) {
                    if (Date.now() - this.circuitBreaker.lastFailure > this.circuitBreaker.resetTimeout) {
                        this.resetCircuitBreaker();
                    } else {
                        sessionLogger.warn('CrashNotificationManager', 'Circuit breaker is open, skipping notification');
                        return;
                    }
                }
                
                const success = await this.attemptDiscordNotification(channelType, embed);
                
                if (success) {
                    this.recordSuccessfulNotification(notificationKey);
                    this.resetCircuitBreaker();
                    return;
                }
                
            } catch (err) {
                lastError = err;
                this.recordFailedNotification();
                sessionLogger.warn('CrashNotificationManager', `Notification attempt ${attempt} failed:`, err.message);
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
                await this.sleep(1000 * Math.pow(2, attempt));
            }
        }
        
        // All retries failed - use emergency fallback
        await this.emergencyFallback(channelType, embed, lastError);
    }
    
    /**
     * Attempt to send Discord notification
     */
    async attemptDiscordNotification(channelType, embed) {
        try {
            const channelId = this.channels[channelType];
            if (!channelId) {
                sessionLogger.error('CrashNotificationManager', `Unknown channel type: ${channelType}`);
                return false;
            }
            
            const { sendWebhook } = require('../discord/webhook');
            
            // Prepare webhook message
            const webhookMessage = {
                username: 'Valhalla Crash Monitor',
                avatarURL: 'https://cdn.discordapp.com/emojis/1068771797878722560.webp', // Use existing emoji
                embeds: embed ? [embed] : []
            };
            
            // If no embed, send a text fallback
            if (!embed) {
                webhookMessage.content = '⚠️ Crash detected but notification formatting failed';
            }
            
            // Send via webhook
            await sendWebhook(channelId, webhookMessage);
            
            return true;
            
        } catch (err) {
            sessionLogger.error('CrashNotificationManager', 'Webhook notification failed:', err.message);
            return false;
        }
    }
    
    /**
     * Emergency fallback when all Discord attempts fail
     */
    async emergencyFallback(channelType, embed, lastError) {
        try {
            this.fallbackAttempts++;
            this.emergencyMode = true;
            
            // Log to session logger as emergency record
            const fallbackMsg = `EMERGENCY FALLBACK: ${channelType} notification failed after all retries. Last error: ${lastError?.message}`;
            sessionLogger.fatal('CrashNotificationManager', fallbackMsg);
            
            // Try console as absolute last resort
            console.error(`[EMERGENCY] Discord notification failed: ${channelType}`);
            console.error(`[EMERGENCY] Embed data:`, embed?.data || 'No embed data');
            
        } catch (err) {
            // Even emergency fallback cannot be allowed to crash
            console.error('[CRITICAL] Emergency fallback failed:', err.message);
        }
    }
    
    /**
     * Check if notification should be suppressed due to rate limiting
     */
    shouldSuppressNotification(notificationKey) {
        const now = Date.now();
        
        // Check deduplication (exact same notification)
        const lastNotification = this.lastNotifications.get(notificationKey);
        if (lastNotification && now - lastNotification < this.rateLimitWindow) {
            return true;
        }
        
        // Check rate limiting (too many notifications)
        const windowStart = now - this.rateLimitWindow;
        const recentCount = Array.from(this.recentNotifications.entries())
            .filter(([key, time]) => time > windowStart)
            .length;
            
        if (recentCount >= this.maxNotificationsPerWindow) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Record successful notification for rate limiting
     */
    recordSuccessfulNotification(notificationKey) {
        const now = Date.now();
        this.lastNotifications.set(notificationKey, now);
        this.recentNotifications.set(notificationKey, now);
    }
    
    /**
     * Record failed notification for circuit breaker
     */
    recordFailedNotification() {
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailure = Date.now();
        
        if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
            this.circuitBreaker.isOpen = true;
            sessionLogger.warn('CrashNotificationManager', 'Circuit breaker opened due to repeated failures');
        }
    }
    
    /**
     * Reset circuit breaker after timeout
     */
    resetCircuitBreaker() {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
        sessionLogger.info('CrashNotificationManager', 'Circuit breaker reset');
    }
    
    /**
     * Clean up old notifications from memory
     */
    cleanupOldNotifications() {
        try {
            const cutoff = Date.now() - this.rateLimitWindow * 2;
            
            for (const [key, time] of this.lastNotifications.entries()) {
                if (time < cutoff) {
                    this.lastNotifications.delete(key);
                }
            }
            
            for (const [key, time] of this.recentNotifications.entries()) {
                if (time < cutoff) {
                    this.recentNotifications.delete(key);
                }
            }
            
        } catch (err) {
            // Cleanup errors cannot crash the system
            sessionLogger.warn('CrashNotificationManager', 'Cleanup warning:', err.message);
        }
    }
    
    /**
     * Generate hash for crash data deduplication
     */
    hashCrashData(crashData) {
        try {
            const crypto = require('crypto');
            const dataToHash = `${crashData.error?.name}:${crashData.error?.message}:${crashData.severity}`;
            return crypto.createHash('sha256').update(dataToHash).digest('hex').substring(0, 16);
        } catch (err) {
            // If hashing fails, use timestamp to ensure uniqueness
            return Date.now().toString();
        }
    }
    
    /**
     * Truncate text to specified length
     */
    truncateText(text, maxLength) {
        if (!text) return 'N/A';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    /**
     * Sleep utility function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Handle notification errors safely
     */
    handleNotificationError(functionName, error) {
        try {
            sessionLogger.error('CrashNotificationManager', `${functionName} error:`, error.message);
            
            // Log to console as emergency backup
            console.error(`[CrashNotificationManager] ${functionName} failed:`, error.message);
            
        } catch (err) {
            // Even error handling cannot crash
            console.error('[CRITICAL] CrashNotificationManager error handler failed:', err.message);
        }
    }
    
    /**
     * Get notification statistics
     */
    getStats() {
        return {
            emergencyMode: this.emergencyMode,
            fallbackAttempts: this.fallbackAttempts,
            circuitBreakerOpen: this.circuitBreaker.isOpen,
            recentNotifications: this.recentNotifications.size,
            totalNotifications: this.lastNotifications.size
        };
    }
}

// Singleton instance to prevent multiple notification managers
let notificationManager = null;

module.exports = {
    /**
     * Get the notification manager instance (singleton)
     */
    getNotificationManager() {
        try {
            if (!notificationManager) {
                notificationManager = new CrashNotificationManager();
            }
            return notificationManager;
        } catch (err) {
            console.error('Failed to create crash notification manager:', err.message);
            return null;
        }
    },
    
    /**
     * Quick access functions for common notifications
     */
    async sendCriticalCrash(crashData) {
        try {
            const manager = module.exports.getNotificationManager();
            if (manager) {
                await manager.sendCriticalCrashNotification(crashData);
            }
        } catch (err) {
            console.error('sendCriticalCrash failed:', err.message);
        }
    },
    
    async sendServerCrash(serverData) {
        try {
            const manager = module.exports.getNotificationManager();
            if (manager) {
                await manager.sendServerCrashNotification(serverData);
            }
        } catch (err) {
            console.error('sendServerCrash failed:', err.message);
        }
    }
};