const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

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
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
        console.log(`Loaded ${commands} commands!`);
    }
};