const {
    SlashCommandBuilder
} = require('discord.js');
const {
    getServers
} = require('../../modules/mongo');
const {
    sendCommand
} = require('../../modules/pterodactyl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('execute')
        .setDescription('Execute a command on the server!')
        .addStringOption(option =>
            option.setName('server')
            .setDescription('Name of the server to execute the command on')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('command')
            .setDescription('Command to execute')
            .setRequired(true))
        .setDMPermission(false),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const serverList = await getServers();
        const choices = ["all"];

        for (const server of serverList) {
            choices.push(`${server.name}`);
        }

        const filtered = choices.filter(choice => choice.startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({
                name: choice,
                value: choice
            })),
        );
    },

    async execute(interaction) {
        const query = interaction.options.getString('server');
        const command = interaction.options.getString('command');

        const serverList = await getServers();
        if (query === 'all') {
            for (const server of serverList) {
                sendCommand(server.serverId, command);
                console.log(`Sent command to ${server.serverId}`);
            }
            await interaction.reply(`Sent command to **all** servers!`);
            return;
        } else {
            const server = serverList.find(server => server.name === query || server.tag === query.toLowerCase());
            if (!server) {
                await interaction.reply('Server not found!');
                return;
            }
            sendCommand(server.serverId, command);

            await interaction.reply(`Sent command to **${server.name}**!`);
            //TODO Get responses from the servers!
        }
    }
};