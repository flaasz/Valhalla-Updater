/*
 * File: deploy.js
 * Project: valhalla-updater
 * File Created: Friday, 17th May 2024 12:28:43 am
 * Author: flaasz
 * -----
 * Last Modified: Thursday, 13th June 2024 5:05:12 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const {
    REST,
    Routes
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;

const commands = [];

// Grab all the command files from the commands directory you created earlier
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
// Grab the SlashCommandBuilder#tojson() output of each command's data for deployment
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command || 'autocomplete' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}


// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);


module.exports = {
    deployCommands: async function (clientId) {
        try {
            // The put method is used to fully refresh all commands in the guild with the current set
            const data = await rest.put(
                Routes.applicationCommands(clientId), {
                    body: commands
                },
            );

            console.log(`Successfully loaded ${data.length} slash commands.`);
        } catch (error) {
            // And of course, make sure you catch and log any errors!
            console.error(error);
        }
    }
};