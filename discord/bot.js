/*
 * File: bot.js
 * Project: valhalla-updater
 * File Created: Friday, 17th May 2024 12:02:23 am
 * Author: flaasz
 * -----
 * Last Modified: Wednesday, 29th May 2024 1:09:25 am
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
const sessionLogger = require('../modules/sessionLogger');

require('dotenv').config();

const token = process.env.DISCORD_TOKEN;

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

module.exports = {
    launchBot: async function () {
        try {
            sessionLogger.info('DiscordBot', 'Initializing Discord bot...');
            
            commands.loadCommandFiles(client);
            sessionLogger.info('DiscordBot', 'Command files loaded');
            
            events.loadEventFiles(client);
            sessionLogger.info('DiscordBot', 'Event files loaded');

            sessionLogger.info('DiscordBot', 'Connecting to Discord...');
            await client.login(token);
            sessionLogger.info('DiscordBot', 'Successfully connected to Discord');
        } catch (error) {
            sessionLogger.error('DiscordBot', 'Failed to launch bot', error.message);
            throw error;
        }
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