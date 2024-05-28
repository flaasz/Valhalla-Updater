/*
 * File: update.js
 * Project: Valhalla-Updater
 * File Created: Friday, 24th May 2024 2:02:16 pm
 * Author: flaasz
 * -----
 * Last Modified: Tuesday, 28th May 2024 8:56:14 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const {
    SlashCommandBuilder
} = require('discord.js');
const { getServers } = require('../../modules/mongo');
const updater = require('../../managers/updateManager');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('update')
		.setDescription('Runs an update sequence on a server!')
        .setDefaultMemberPermissions(0)
        .setDMPermission(false)
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
        await interaction.editReply("Update manager is starting...");

        const message = await interaction.fetchReply();

        const server = serverList.find(server => server.name === query || server.tag === query.toLowerCase());
        if (!server || server.requiresUpdate === false) {
            await message.edit(`Server **${query}** not found or doesn't need an update!`);
            return;
        }

        let time = Date.now();
        switch (server.platform) {
            case "curseforge": 
                await updater.updateCF(server, message);
                break;
            case "feedthebeast":
                await updater.updateFTB(server, message);
                break;
            case "gregtechnewhorizons":
                await updater.updateGTNH(server, message);
                break;
            default:
                await message.edit('Platform not supported!');
        }
        await message.reply(`Done! This update took ${((Date.now()-time)/1000/60).toFixed(2)} minutes.`);
	},
};  