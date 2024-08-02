const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord-api-types/v10');
const { EmbedBuilder } = require('discord.js');
const mongo = require('../../modules/mongo');
const serverReboot = require('../../schedulers/serverReboot');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reboot')
        .setDescription('Manage server reboots')
        .addSubcommand(subcommand =>
            subcommand
                .setName('queue')
                .setDescription('Queue a server for reboot')
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('The name of the server to reboot')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel a queued reboot')
                .addStringOption(option =>
                    option.setName('reboot_id')
                        .setDescription('The ID of the reboot to cancel')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Get reboot statistics for a server')
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('The name of the server')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('queue_status')
                .setDescription('Get the current reboot queue status'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageServer),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'queue':
                return this.queueReboot(interaction);
            case 'cancel':
                return this.cancelReboot(interaction);
            case 'stats':
                return this.getRebootStats(interaction);
            case 'queue_status':
                return this.getQueueStatus(interaction);
        }
    },

    async queueReboot(interaction) {
        const serverName = interaction.options.getString('server');
        const servers = await mongo.getServers();
        const server = servers.find(s => s.name.toLowerCase() === serverName.toLowerCase());

        if (!server) {
            return interaction.editReply('Server not found.');
        }

        const rebootId = serverReboot.queueReboot(server, serverReboot.defaultConfig, "Manual reboot");
        const rebootStats = await mongo.getRebootStats(server.serverId);
        
        const lastReboot = rebootStats.lastReboot ? new Date(rebootStats.lastReboot.timestamp).toLocaleString() : 'Never';
        return interaction.editReply(`Server ${server.name} has been queued for reboot.\nReboot ID: ${rebootId}\nTotal reboots: ${rebootStats.totalReboots}\nLast reboot: ${lastReboot}`);
    },

    async cancelReboot(interaction) {
        const rebootId = interaction.options.getString('reboot_id');
        const result = serverReboot.cancelReboot(rebootId);
        return interaction.editReply(result.message);
    },

    async getRebootStats(interaction) {
        const serverName = interaction.options.getString('server');
        const servers = await mongo.getServers();
        const server = servers.find(s => s.name.toLowerCase() === serverName.toLowerCase());

        if (!server) {
            return interaction.editReply('Server not found.');
        }

        const stats = await mongo.getRebootStats(server.serverId);
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Reboot Statistics for ${server.name}`)
            .addFields(
                { name: 'Total Reboots', value: stats.totalReboots.toString(), inline: true },
                { name: 'Average Duration', value: `${(stats.averageDuration / 1000).toFixed(2)} seconds`, inline: true },
                { name: 'Reboot Frequency', value: `${stats.rebootFrequency.toFixed(2)} per day`, inline: true },
                { name: 'Last Reboot', value: stats.lastReboot ? new Date(stats.lastReboot.timestamp).toLocaleString() : 'Never', inline: false },
                { name: 'Last Reboot Reason', value: stats.lastReboot ? stats.lastReboot.reason : 'N/A', inline: false }
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },

    async getQueueStatus(interaction) {
        const queueStatus = serverReboot.getQueueStatus();
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Current Reboot Queue')
            .setDescription(queueStatus.length === 0 ? 'No servers currently queued for reboot.' : '')
            .addFields(
                queueStatus.map(reboot => ({
                    name: `${reboot.serverName} (ID: ${reboot.id})`,
                    value: `Reason: ${reboot.reason}\nQueued at: ${reboot.queuedAt}\nPriority: ${reboot.priority}`
                }))
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },

    async autocomplete(interaction) {
        const servers = await mongo.getServers();
        const focusedValue = interaction.options.getFocused();
        const filtered = servers.filter(server => server.name.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(
            filtered.map(server => ({ name: server.name, value: server.name })).slice(0, 25)
        );
    },
};
