/*
 * File: banall.js
 * Project: Valhalla-Updater
 * File Created: Friday, 24th May 2024 12:23:58 pm
 * Author: flaasz
 * -----
 * Last Modified: Sunday, 26th May 2024 10:50:09 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const {
    SlashCommandBuilder
} = require('discord.js');
const {
    sendCommand
} = require('../../modules/pterodactyl');
const {
    velocityID
} = require('../../config/config.json');
const {
    sleep
} = require('../../modules/functions');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('banall')
        .setDescription('Bans a list of players!')
        .setDefaultMemberPermissions(0)
        .addStringOption(option =>
            option
            .setName('targets')
            .setDescription('List of members to ban, separated by commas or spaces')
            .setRequired(true))
        .addStringOption(option =>
            option
            .setName('reason')
            .setDescription('The reason for banning'))
        .setDMPermission(false),
    async execute(interaction) {
        const targets = interaction.options.getString('targets').split(/, |[ ,]/g);
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        await interaction.deferReply();

        for (const target of targets) {
            if (target === '') continue;
            await sendCommand(velocityID, `ban ${target} ${reason}`);
            console.log(`Banned ${target} for ${reason}`);
            await sleep(400);
        }

        await interaction.editReply(`Banned **${targets.length}** players for **${reason}**.`);
    },
};