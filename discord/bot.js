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

commands.loadCommandFiles(client);
events.loadEventFiles(client);

module.exports = {
    launchBot: function () {
        client.login(token);
    }
};