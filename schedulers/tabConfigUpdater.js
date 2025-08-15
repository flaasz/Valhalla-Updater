const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tabConfigGen = require('../modules/tabConfigGen');
const pterodactyl = require('../modules/pterodactyl');
const sessionLogger = require('../modules/sessionLogger');
const { sendWebhook } = require('../discord/webhook');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'tabConfigUpdater',
    defaultConfig: {
        "active": true,
        "interval": 5,
        "backupRetention": 5,
        "validationTimeout": 5000
    },

    lastServerHash: null,
    velocityServerId: "c3883322",
    configPath: path.join(__dirname, '../velocity-tab/config.yml'),
    backupDir: path.join(__dirname, '../velocity-tab/backups'),

    start: function (options) {
        sessionLogger.info('TabConfigUpdater', 'Starting tab configuration updater scheduler');
        
        // Ensure backup directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }

        // Run immediately on start
        this.updateTabConfig(options);
        
        // Set interval
        setInterval(() => {
            this.updateTabConfig(options);
        }, options.interval * 60 * 1000);
    },

    updateTabConfig: async function (options) {
        try {
            sessionLogger.info('TabConfigUpdater', 'Checking for server changes...');

            // Get current server data and generate hash
            const currentHash = await tabConfigGen.generateServerHash();
            
            // Check if servers have changed
            if (this.lastServerHash === currentHash) {
                sessionLogger.debug('TabConfigUpdater', 'No server changes detected, skipping update');
                return;
            }

            sessionLogger.info('TabConfigUpdater', 'Server changes detected, updating tab configuration...');

            // Create backup
            const backupPath = await this.createBackup();
            
            try {
                // Generate new configuration
                const newConfig = await tabConfigGen.generateTabConfigContent();
                
                // Update configuration file
                await this.updateConfigFile(newConfig);
                
                // Validate the updated file
                if (!this.validateConfigFile()) {
                    throw new Error('Configuration validation failed');
                }

                // Reload tab configuration on velocity server
                await this.reloadTabConfig();
                
                // Update hash on success
                this.lastServerHash = currentHash;
                
                sessionLogger.info('TabConfigUpdater', 'Tab configuration updated successfully');
                
                // Cleanup old backups
                this.cleanupOldBackups(options.backupRetention);
                
            } catch (error) {
                sessionLogger.error('TabConfigUpdater', 'Failed to update configuration:', error.message);
                
                // Restore from backup
                if (backupPath && fs.existsSync(backupPath)) {
                    fs.copyFileSync(backupPath, this.configPath);
                    sessionLogger.info('TabConfigUpdater', 'Configuration restored from backup');
                }
                
                // Send notification to backend channel
                await this.notifyError(error);
                throw error;
            }
            
        } catch (error) {
            sessionLogger.error('TabConfigUpdater', 'Tab configuration update failed:', error.message);
            await this.notifyError(error);
        }
    },

    createBackup: function () {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `config_backup_${timestamp}.yml`);
            
            if (fs.existsSync(this.configPath)) {
                fs.copyFileSync(this.configPath, backupPath);
                sessionLogger.debug('TabConfigUpdater', `Backup created: ${backupPath}`);
                return backupPath;
            }
            
            return null;
        } catch (error) {
            sessionLogger.error('TabConfigUpdater', 'Failed to create backup:', error.message);
            throw new Error(`Backup creation failed: ${error.message}`);
        }
    },

    updateConfigFile: function (newConfigContent) {
        try {
            // Read current config
            if (!fs.existsSync(this.configPath)) {
                throw new Error('Original config file not found');
            }

            const currentConfig = fs.readFileSync(this.configPath, 'utf8');
            
            // Find the section to replace (after "false: ~%essentials_nickname%" to "placeholderapi-refresh-intervals")
            const startMarker = 'false: ~%essentials_nickname%';
            const endMarker = 'placeholderapi-refresh-intervals:';
            
            const startIndex = currentConfig.indexOf(startMarker);
            if (startIndex === -1) {
                throw new Error('Start marker not found in config file');
            }
            
            const endIndex = currentConfig.indexOf(endMarker);
            if (endIndex === -1) {
                throw new Error('End marker not found in config file');
            }

            // Calculate position after the start marker line
            const startLineEnd = currentConfig.indexOf('\n', startIndex);
            if (startLineEnd === -1) {
                throw new Error('Could not find end of start marker line');
            }

            // Build new config content
            const beforeSection = currentConfig.substring(0, startLineEnd + 1);
            const afterSection = currentConfig.substring(endIndex);
            const updatedConfig = beforeSection + newConfigContent + afterSection;

            // Write to temporary file first (atomic operation)
            const tempPath = this.configPath + '.tmp';
            fs.writeFileSync(tempPath, updatedConfig, 'utf8');
            
            // Replace original file
            fs.renameSync(tempPath, this.configPath);
            
            sessionLogger.debug('TabConfigUpdater', 'Configuration file updated successfully');
            
        } catch (error) {
            sessionLogger.error('TabConfigUpdater', 'Failed to update config file:', error.message);
            throw new Error(`Config file update failed: ${error.message}`);
        }
    },

    validateConfigFile: function () {
        try {
            // Basic validation - check if file exists and is readable
            if (!fs.existsSync(this.configPath)) {
                return false;
            }

            const config = fs.readFileSync(this.configPath, 'utf8');
            
            // Check for required sections
            const requiredSections = [
                'conditions:',
                'placeholderapi-refresh-intervals:',
                'false: ~%essentials_nickname%'
            ];

            for (const section of requiredSections) {
                if (!config.includes(section)) {
                    sessionLogger.error('TabConfigUpdater', `Missing required section: ${section}`);
                    return false;
                }
            }

            // Basic YAML structure validation (check indentation consistency)
            const lines = config.split('\n');
            let hasValidStructure = false;
            
            for (const line of lines) {
                if (line.trim().startsWith('tag') && line.includes(':')) {
                    hasValidStructure = true;
                    break;
                }
            }

            if (!hasValidStructure) {
                sessionLogger.error('TabConfigUpdater', 'Configuration structure validation failed');
                return false;
            }

            return true;
            
        } catch (error) {
            sessionLogger.error('TabConfigUpdater', 'Config validation error:', error.message);
            return false;
        }
    },

    reloadTabConfig: async function () {
        try {
            sessionLogger.info('TabConfigUpdater', 'Reloading tab configuration on velocity server...');
            
            await pterodactyl.sendCommand(this.velocityServerId, 'btab reload');
            
            // Wait a moment for the command to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            sessionLogger.info('TabConfigUpdater', 'Tab configuration reloaded successfully');
            
        } catch (error) {
            sessionLogger.error('TabConfigUpdater', 'Failed to reload tab config:', error.message);
            throw new Error(`Tab reload failed: ${error.message}`);
        }
    },

    cleanupOldBackups: function (retentionCount) {
        try {
            if (!fs.existsSync(this.backupDir)) {
                return;
            }

            const backupFiles = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('config_backup_') && file.endsWith('.yml'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    mtime: fs.statSync(path.join(this.backupDir, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            // Keep only the specified number of backups
            if (backupFiles.length > retentionCount) {
                const filesToDelete = backupFiles.slice(retentionCount);
                
                for (const file of filesToDelete) {
                    fs.unlinkSync(file.path);
                    sessionLogger.debug('TabConfigUpdater', `Deleted old backup: ${file.name}`);
                }
            }
            
        } catch (error) {
            sessionLogger.warn('TabConfigUpdater', 'Failed to cleanup old backups:', error.message);
        }
    },

    notifyError: async function (error) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🚨 Tab Configuration Update Failed')
                .setDescription(`Tab configuration automatic update encountered an error:\n\`\`\`${error.message}\`\`\``)
                .setColor('#FF0000')
                .addFields(
                    { name: 'Component', value: 'TabConfigUpdater', inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                )
                .setTimestamp();

            const notification = {
                embeds: [embed]
            };

            // Send to backend channel (from config.json)
            await sendWebhook('1358558826118381678', notification);
            
        } catch (notificationError) {
            sessionLogger.error('TabConfigUpdater', 'Failed to send error notification:', notificationError.message);
        }
    }
};