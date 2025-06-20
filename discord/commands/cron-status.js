const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const timeManager = require('../../modules/timeManager');
const mongo = require('../../modules/mongo');
const velocityMetrics = require('../../modules/velocityMetrics');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cron-status')
        .setDescription('View comprehensive cron system status')
        .setDefaultMemberPermissions(16)
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            // Get current player data
            const playersData = await velocityMetrics.getPlayers();
            let totalPlayers = 0;
            for (const serverName in playersData) {
                totalPlayers += playersData[serverName].length;
            }
            
            // Get time window info
            const timeWindow = timeManager.checkRebootWindow();
            
            // Get today's reboot stats
            const today = timeManager.getTodayDateString();
            const todayStats = await mongo.getRebootHistory(today);
            
            // Get active cron jobs
            const playerTriggers = await mongo.getActiveCronJobs('player_trigger');
            
            // Get scheduler config
            const config = require('../../config/config.json');
            const cronConfig = config.scheduler.advancedCron || {};
            
            const embed = new EmbedBuilder()
                .setColor(0x9c59b6)
                .setTitle('📋 Advanced Cron System Status')
                .setTimestamp();
            
            // System Status
            embed.addFields(
                { name: '🕐 Current Time (GMT+3)', value: timeWindow.timeString, inline: true },
                { name: '👥 Total Players Online', value: totalPlayers.toString(), inline: true },
                { name: '⚙️ System Active', value: cronConfig.active ? '✅ Yes' : '❌ No', inline: true }
            );
            
            // Reboot System Status
            let rebootStatus = '⏳ Pending';
            if (todayStats) {
                if (todayStats.rebootCompleted) {
                    rebootStatus = '✅ Completed';
                } else if (todayStats.rebootTriggered) {
                    rebootStatus = '🔄 In Progress';
                }
            }
            
            embed.addFields(
                { name: '🔄 Reboot Scheduling', value: cronConfig.rebootCheckEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '📅 Today\'s Reboot', value: rebootStatus, inline: true },
                { name: '🎯 Optimal Window', value: timeWindow.isInWindow ? '✅ Active' : '❌ Inactive', inline: true }
            );
            
            // Today's Statistics
            if (todayStats) {
                const lowestCount = todayStats.lowestPlayerCount !== null ? todayStats.lowestPlayerCount.toString() : 'Not recorded';
                const lowestTime = todayStats.lowestPlayerTime ? new Date(todayStats.lowestPlayerTime).toLocaleTimeString('en-US', { timeZone: 'Europe/Istanbul' }) : 'N/A';
                
                embed.addFields(
                    { name: '📊 Lowest Player Count Today', value: `${lowestCount} at ${lowestTime}`, inline: false }
                );
                
                if (todayStats.rebootCompleted) {
                    const successRate = `${todayStats.successfulReboots}/${todayStats.totalServers}`;
                    const duration = todayStats.totalDuration ? timeManager.formatDuration(todayStats.totalDuration) : 'Unknown';
                    
                    embed.addFields(
                        { name: '✅ Reboot Success Rate', value: successRate, inline: true },
                        { name: '⏱️ Total Duration', value: duration, inline: true },
                        { name: '🔁 Failed Reboots', value: todayStats.failedReboots?.toString() || '0', inline: true }
                    );
                }
            }
            
            // Player Trigger Status
            embed.addFields(
                { name: '🎮 Player Triggers', value: cronConfig.playerTriggerEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '📝 Active Triggers', value: playerTriggers.length.toString(), inline: true }
            );
            
            // Next Actions
            let nextAction = '';
            if (!timeWindow.isInWindow) {
                const minutesToNext = timeManager.minutesUntilNextWindow();
                nextAction = `Next reboot window in ${Math.floor(minutesToNext / 60)}h ${minutesToNext % 60}m`;
            } else if (timeWindow.isAfterDeadline) {
                nextAction = 'Deadline passed - will force reboot if needed';
            } else if (timeWindow.isInOptimalTime) {
                nextAction = 'In optimal window - monitoring for trigger conditions';
            } else {
                nextAction = 'In reboot window - waiting for optimal moment';
            }
            
            embed.addFields({ name: '🎯 Next Action', value: nextAction, inline: false });
            
            // System Configuration
            if (cronConfig.active) {
                const configText = [
                    `Check Interval: ${cronConfig.interval || 30}s`,
                    `Max Concurrent Reboots: ${cronConfig.maxConcurrentReboots || 2}/node`,
                    `Retry Limit: ${cronConfig.rebootRetryLimit || 3}`,
                    `Startup Timeout: ${cronConfig.serverStartupTimeout || 20}min`
                ].join('\n');
                
                embed.addFields({ name: '⚙️ Configuration', value: configText, inline: false });
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in cron-status command:', error.message);
            await interaction.editReply('❌ An error occurred while fetching cron status.');
        }
    }
};