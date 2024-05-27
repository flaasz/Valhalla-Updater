/*
 * File: bot.js
 * Project: Valhalla-Updater
 * File Created: Friday, 17th May 2024 12:02:23 am
 * Author: flaasz
 * -----
 * Last Modified: Monday, 27th May 2024 7:51:19 pm
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

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

module.exports = {
    launchBot: async function () {

        commands.loadCommandFiles(client);
        events.loadEventFiles(client);

        await client.login(token);
    },

    getClient: function () {
        return new Promise((resolve) => {
            if (client.isReady()) {
                resolve(client);
            } else {
                client.once('ready', () => {
                    resolve(client);
                });
            }
        });
    },
};