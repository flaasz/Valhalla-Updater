/*
 * File: execute.js
 * Project: valhalla-updater
 * File Created: Friday, 24th May 2024 4:40:44 pm
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 15th June 2024 3:47:08 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const {
    pterosocket
} = require('pterosocket');
const {
    SlashCommandBuilder,
    AttachmentBuilder
} = require('discord.js');
const {
    getServers
} = require('../../modules/mongo');
const {
    sendCommand
} = require('../../modules/pterodactyl');
const {
    velocityID
} = require("../../config/config.json").pterodactyl;
const pterodactylHostName = require("../../config/config.json").pterodactyl.pterodactylHostName.replace(/\/$/, "");
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('execute')
        .setDescription('Execute a command on the server!')
        .setDefaultMemberPermissions(16)
        .addStringOption(option =>
            option.setName('server')
            .setDescription('Name of the server to execute the command on')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('command')
            .setDescription('Command to execute')
            .setRequired(true))
        .setDMPermission(false),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const serverList = await getServers();
        const choices = ["all", "Velocity"];

        for (const server of serverList) {
            choices.push(`${server.name}`);
        }

        const filtered = choices.filter(choice => choice.startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({
                name: choice,
                value: choice
            })),
        );
    },

    async execute(interaction) {
        const query = interaction.options.getString('server');
        const command = interaction.options.getString('command');

        const serverList = await getServers();
        if (query === 'all') {
            for (const server of serverList) {
                sendCommand(server.serverId, command);
                console.log(`Sent command to ${server.name}`);
            }
            await interaction.reply(`Sent \`${command}\` to **all** servers! 🚀`);
            return;
        } else if (query === 'Velocity') {
            sendCommand(velocityID, command);
            await interaction.reply(`Sent \`${command}\` to **Velocity**! 🚀`);

        } else {
            const server = serverList.find(server => server.name === query || server.tag === query.toLowerCase());
            if (!server) {
                await interaction.reply('Server not found!');
                return;
            }

            let reply = `Sent \`${command}\` to **${server.name}**! 🚀`;
            await interaction.reply(reply);

            let response = await sendAdvancedCommand(server.serverId, command);
            console.log(response);
            if (response === "") {
                await interaction.editReply(reply + "\n **The server did not respond!**");
            } else
            if (response.length < 1900) {
                await interaction.editReply(reply + "\n```" + response + "```");
            } else {
                const buffer = Buffer.from(response, 'utf-8');
                const attachment = new AttachmentBuilder(buffer, {
                    name: 'message.txt'
                });
                await interaction.followUp({
                    files: [attachment]
                });
            }
        }
    }
};

/**
 * Sends a command to a server using the Pterodactyl socket, and returns the response.
 * @param {string} serverId Id of the server on Pterodactyl.
 * @param {string} command Command to be executed on the server.
 * @returns {string} Response from the server.
 */
async function sendAdvancedCommand(serverId, command) {
    response = "";

    return new Promise((resolve, reject) => {

        const socket = new pterosocket(pterodactylHostName, process.env.PTERODACTYL_APIKEY, serverId);

        socket.once("start", async () => {
            await sendCommand(serverId, command);
            setTimeout(() => {
                socket.close();
            }, 3000);
        });

        socket.on('console_output', (output) => {
            output = output.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
            console.log("Received output:", output);

            const headerRegex = /\[\d\d:\d\d:\d\d\] \[Server thread\/INFO] \[minecraft\/MinecraftServer\]: |\[\d\d:\d\d:\d\d\] \[Server thread\/INFO]: |\[\d\d:\d\d:\d\d\] \[Server thread\/INFO] \[minecraft\/DedicatedServer\]: /gm;

            if (headerRegex.test(output) || output === command) {
                if (output != command) {
                    output = output.replace(headerRegex, "");
                    response += output + "\n";
                }
            }
        });

        socket.once('close', () => {
            resolve(response);
        });

        socket.once('error', (error) => {
            console.error("Socket error:", error);
            reject(error);
        });
    });
}