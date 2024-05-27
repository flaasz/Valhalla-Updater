/*
 * File: ready.js
 * Project: Valhalla-Updater
 * File Created: Friday, 17th May 2024 12:59:37 am
 * Author: flaasz
 * -----
 * Last Modified: Monday, 27th May 2024 7:50:21 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */
const {
    Events
} = require('discord.js');
const {
    deployCommands
} = require('../deploy');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        await deployCommands(client.user.id);
    }
};