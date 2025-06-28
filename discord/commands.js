/*
 * File: commands.js
 * Project: Valhalla-Updater
 * File Created: Friday, 17th May 2024 2:03:56 am
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 25th May 2024 4:05:05 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const sessionLogger = require('../modules/sessionLogger');

module.exports = {
    loadCommandFiles: function (client) {
        client.commands = new Collection();

        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        let commands = 0;
        for (const file of commandFiles) {
            commands++;
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            // Set a new item in the Collection with the key as the command name and the value as the exported module
            if ('data' in command && 'execute' in command || 'autocomplete' in command) {
                client.commands.set(command.data.name, command);
            } else {
                sessionLogger.warn('CommandLoader', `The command at ${filePath} is missing a required "data" or "execute" property`);
            }
        }
        sessionLogger.info('CommandLoader', `Loaded ${commands} commands`);
    }
};