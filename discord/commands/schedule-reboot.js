const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const timeManager = require('../../modules/timeManager');
const mongo = require('../../modules/mongo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule-reboot')
        .setDescription('Manage automatic server reboots')
        .setDefaultMemberPermissions(16)
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check current reboot status and timing'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('force')
                .setDescription('Force start reboot sequence immediately'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable automatic reboot scheduling'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable automatic reboot scheduling'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('View recent reboot history')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days to look back (default: 7)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(30)))
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply();
        
        const subcommand = interaction.options.getSubcommand();
        
        try {
            switch (subcommand) {
                case 'status':
                    await this.showRebootStatus(interaction);
                    break;
                case 'force':
                    await this.forceReboot(interaction);
                    break;
                case 'enable':
                    await this.enableRebootScheduling(interaction);
                    break;
                case 'disable':
                    await this.disableRebootScheduling(interaction);
                    break;
                case 'history':
                    await this.showRebootHistory(interaction);
                    break;
                default:
                    await interaction.editReply('Unknown subcommand!');
            }
        } catch (error) {
            console.error('Error in schedule-reboot command:', error.message);
            await interaction.editReply('An error occurred while processing the command.');
        }
    },

    async showRebootStatus(interaction) {
        const timeWindow = timeManager.checkRebootWindow();
        const today = timeManager.getTodayDateString();
        const todayStats = await mongo.getRebootHistory(today);
        
        // Get scheduler status
        const config = require('../../config/config.json');
        const isEnabled = config.scheduler.advancedCron?.rebootCheckEnabled || false;
        
        const embed = new EmbedBuilder()
            .setColor(0x9c59b6)
            .setTitle('🔄 Reboot System Status')
            .setTimestamp();
        
        // Current time info
        embed.addFields(
            { name: 'Current Time (GMT+3)', value: timeWindow.timeString, inline: true },
            { name: 'In Reboot Window', value: timeWindow.isInWindow ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Scheduler Enabled', value: isEnabled ? '✅ Enabled' : '❌ Disabled', inline: true }
        );
        
        // Today's stats
        if (todayStats) {
            embed.addFields(
                { name: 'Today\'s Status', value: todayStats.rebootCompleted ? '✅ Completed' : todayStats.rebootTriggered ? '🔄 In Progress' : '⏳ Pending', inline: true },
                { name: 'Lowest Player Count', value: todayStats.lowestPlayerCount !== null ? todayStats.lowestPlayerCount.toString() : 'Not recorded', inline: true }
            );
            
            if (todayStats.rebootCompleted) {
                embed.addFields(
                    { name: 'Success Rate', value: `${todayStats.successfulReboots}/${todayStats.totalServers} servers`, inline: true },
                    { name: 'Total Duration', value: timeManager.formatDuration(todayStats.totalDuration || 0), inline: true }
                );
            }
        } else {
            embed.addFields({ name: 'Today\'s Status', value: '⏳ No data yet', inline: true });
        }
        
        // Next window info
        if (!timeWindow.isInWindow) {
            const minutesToNext = timeManager.minutesUntilNextWindow();
            embed.addFields({ name: 'Next Window', value: `In ${Math.floor(minutesToNext / 60)}h ${minutesToNext % 60}m`, inline: true });
        }
        
        await interaction.editReply({ embeds: [embed] });
    },

    async forceReboot(interaction) {
        // Check if reboot is already in progress
        const today = timeManager.getTodayDateString();
        const todayStats = await mongo.getRebootHistory(today);
        
        if (todayStats && todayStats.rebootTriggered && !todayStats.rebootCompleted) {
            await interaction.editReply('❌ A reboot sequence is already in progress!');
            return;
        }
        
        if (todayStats && todayStats.rebootCompleted) {
            await interaction.editReply('❌ Reboot already completed today!');
            return;
        }
        
        // Trigger manual reboot
        const schedulerModule = require('../../schedulers/advancedCron');
        
        try {
            await schedulerModule.triggerRebootSequence(
                `Manual trigger by ${interaction.user.username} (${interaction.user.id})`,
                0 // Player count not relevant for manual trigger
            );
            
            const embed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle('🚨 Manual Reboot Triggered')
                .setDescription('Reboot sequence has been started manually. Check staff channel for progress updates.')
                .addFields(
                    { name: 'Triggered By', value: interaction.user.username, inline: true },
                    { name: 'Time', value: timeManager.getCurrentTimeGMT3().toISOString(), inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error forcing reboot:', error.message);
            await interaction.editReply('❌ Failed to trigger reboot sequence.');
        }
    },

    async enableRebootScheduling(interaction) {
        // Update config
        const config = require('../../config/config.json');
        
        if (!config.scheduler.advancedCron) {
            config.scheduler.advancedCron = {
                active: true,
                interval: 30,
                rebootCheckEnabled: true,
                playerTriggerEnabled: true,
                maxConcurrentReboots: 2,
                rebootRetryLimit: 3,
                serverStartupTimeout: 20
            };
        } else {
            config.scheduler.advancedCron.rebootCheckEnabled = true;
        }
        
        // Write config back
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../../config/config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Reboot Scheduling Enabled')
            .setDescription('Automatic reboot scheduling is now enabled. Servers will be rebooted during optimal windows (9:00-11:00 GMT+3).')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },

    async disableRebootScheduling(interaction) {
        // Update config
        const config = require('../../config/config.json');
        
        if (config.scheduler.advancedCron) {
            config.scheduler.advancedCron.rebootCheckEnabled = false;
        }
        
        // Write config back
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../../config/config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Reboot Scheduling Disabled')
            .setDescription('Automatic reboot scheduling is now disabled. Only manual reboots will be possible.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },

    async showRebootHistory(interaction) {
        const days = interaction.options.getInteger('days') || 7;
        const history = await mongo.getRecentRebootHistory(days);
        
        if (history.length === 0) {
            await interaction.editReply(`No reboot history found for the last ${days} days.`);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setColor(0x9c59b6)
            .setTitle(`📊 Reboot History (Last ${days} days)`)
            .setTimestamp();
        
        for (const record of history.slice(0, 10)) {
            let statusText = '';
            if (record.rebootCompleted) {
                statusText = `✅ Completed - ${record.successfulReboots}/${record.totalServers} servers`;
                if (record.totalDuration) {
                    statusText += ` in ${timeManager.formatDuration(record.totalDuration)}`;
                }
            } else if (record.rebootTriggered) {
                statusText = '🔄 In Progress';
            } else {
                statusText = '⏳ Not Triggered';
            }
            
            const triggerInfo = record.triggerReason || 'Not triggered';
            const playerCount = record.triggerPlayerCount !== undefined ? ` (${record.triggerPlayerCount} players)` : '';
            
            embed.addFields({
                name: `${record.date}`,
                value: `${statusText}\n**Trigger:** ${triggerInfo}${playerCount}`,
                inline: false
            });
        }
        
        if (history.length > 10) {
            embed.setFooter({ text: `Showing 10 of ${history.length} records` });
        }
        
        await interaction.editReply({ embeds: [embed] });
    }
};