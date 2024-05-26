/*
 * File: ping.js
 * Project: Valhalla-Updater
 * File Created: Friday, 17th May 2024 12:23:38 am
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 25th May 2024 4:00:52 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	async execute(interaction) {
		await interaction.reply(`Pong! ${interaction.client.ws.ping}ms`);
	},
};