const {
    SlashCommandBuilder
} = require('discord.js');
const { loadCommandFiles } = require('../commands');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('reloadcommands')
        .setDescription('Reloads all commands on the bot!')
        .setDefaultMemberPermissions(0),
    async execute(interaction) {
        const {
            deployCommands
        } = require('../deploy');

        await loadCommandFiles(interaction.client);
        await deployCommands(interaction.client.user.id);
        await interaction.reply('Reloaded all commands!');
    },
};