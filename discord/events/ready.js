const {
    Events
} = require('discord.js');
const {
    deployCommands
} = require('../deploy');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        deployCommands(client.user.id);

    }
};