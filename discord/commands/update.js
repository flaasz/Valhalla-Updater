const {
    SlashCommandBuilder
} = require('discord.js');
const { getServers } = require('../../modules/mongo');
const updater = require('../../modules/updater');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('update')
		.setDescription('Runs an update sequence on a server!')
		.addStringOption(option =>
			option.setName('server')
				.setDescription('Server to update')
                .setRequired(true)
				.setAutocomplete(true)),
	async autocomplete(interaction) {
		const focusedValue = interaction.options.getFocused();
        const serverList = await getServers();
		const choices = [];

        for (const server of serverList) {
            if (server.requiresUpdate === true) {
                choices.push(server.name);
            }
        }

		const filtered = choices.filter(choice => choice.startsWith(focusedValue));
		await interaction.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
	},

    async execute(interaction) {
        const query = interaction.options.getString('server');
        const serverList = await getServers();
        await interaction.deferReply();

        const server = serverList.find(server => server.name === query || server.tag === query.toLowerCase());
        if (!server || server.requiresUpdate === false) {
            await interaction.followUp('Server not found!');
            return;
        }

        let time = Date.now();
        switch (server.platform) {
            case "curseforge": 
                await updater.updateCF(server, interaction);
                break;
            case "feedthebeast":
                await updater.updateFTB(server, interaction);
                break;
            case "gregtechnewhorizons":
                await updater.updateGTNH(server, interaction);
                break;
            default:
                await interaction.followUp('Platform not supported!');
        }
        await interaction.followUp(`Done! ${(Date.now()-time)/1000/60}m`);
	},
};