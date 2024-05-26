/*
 * File: reloadCommands.js
 * Project: Valhalla-Updater
 * File Created: Friday, 17th May 2024 1:03:42 am
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 25th May 2024 4:01:01 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

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