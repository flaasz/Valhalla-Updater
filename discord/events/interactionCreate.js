/*
 * File: interactionCreate.js
 * Project: Valhalla-Updater
 * File Created: Friday, 17th May 2024 12:58:32 am
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 25th May 2024 4:01:17 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const { Events } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {

        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
    
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
    
            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(error);
            }

        }

        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
    
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
    
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'There was an error while executing this command!',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'There was an error while executing this command!',
                    ephemeral: true
                });
            }
        }
	},
};