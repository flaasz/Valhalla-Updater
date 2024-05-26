/*
 * File: bot.js
 * Project: Valhalla-Updater
 * File Created: Friday, 17th May 2024 12:02:23 am
 * Author: flaasz
 * -----
 * Last Modified: Sunday, 26th May 2024 5:29:14 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const {
    Client,
    GatewayIntentBits
} = require('discord.js');
const commands = require('./commands');
const events = require('./events');

require('dotenv').config();

const token = process.env.DISCORD_TOKEN;

module.exports = {
    launchBot: function () {
        const client = new Client({
            intents: [GatewayIntentBits.Guilds]
        });
        
        commands.loadCommandFiles(client);
        events.loadEventFiles(client);

        client.login(token);
    }
};