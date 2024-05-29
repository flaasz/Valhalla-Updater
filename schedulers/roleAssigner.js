/*
 * File: roleAssigner.js
 * Project: valhalla-updater
 * File Created: Wednesday, 29th May 2024 7:30:52 pm
 * Author: flaasz
 * -----
 * Last Modified: Thursday, 30th May 2024 12:36:02 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */
const { rmSync } = require("fs-extra");
const {
    getClient
} = require("../discord/bot");
const {
    getWebhook
} = require("../discord/webhook");
const { getPackData } = require("../modules/curseforge");
const { download } = require("../modules/downloader");
const {
    sleep
} = require("../modules/functions");
const { getFTBPackData } = require("../modules/modpacksch");
const mongo = require("../modules/mongo");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {
    name: "roleAssigner",
    defaultConfig: {
        "active": true,
        "interval": 1,
        "roleChannelId": "",
        "MentionRoleId": "",
    },

    /**
     * Starts a scheduler that hooks to a message on discord and adds buttons for role assignemnt.
     * @param {object} options Object containing options for the scheduler.
     */
    start: async function (options) {

        if (!options.roleChannelId) return console.log("[WARNING] Set role assigner up in /config/config.json!");

        const client = await getClient();

        client.on("interactionCreate", async interaction => {
            if (interaction.isButton() && interaction.message.channelId === options.roleChannelId) {
                try {
                    let serverList = await mongo.getServers();
                    serverList = await addMentionButton(serverList);
                    let server = serverList.find(server => server.tag === interaction.customId);
                    let replyMessage = "Something went wrong!";
                    //console.log(interaction);
                    const guildMember = await interaction.guild.members.fetch(interaction.user.id);
                    const role = interaction.guild.roles.cache.find(role => role.id === server.discord_role_id);

                    if (guildMember.roles.cache.has(role.id)) {
                        await guildMember.roles.remove(role);
                        console.log(`${interaction.user.globalName} disabled role for ${server.name}`);
                        replyMessage = `Role for ${server.name} **removed**!`;
                    } else {
                        await guildMember.roles.add(role);
                        console.log(`${interaction.user.globalName} enabled role for ${server.name}`);
                        replyMessage = `Role for ${server.name} **enabled**!`;
                    }

                    let response = await interaction.reply({
                        content: replyMessage,
                        ephemeral: true
                    });
                    await sleep(2000);
                    await response.delete();
                } catch (error) {
                    console.error(error);
                }
            }
        });

        async function buildButtons() {

            let serverList = await mongo.getServers();
            serverListFull = await addMentionButton(serverList);

            serverList = serverListFull.filter(server => server.discord_role_id != "");
            serverListMissing = serverListFull.filter(server => server.discord_role_id === ""); 
            await generateNewRoles(serverListMissing);
            
            const webhook = await getWebhook(options.roleChannelId);

            const channel = await client.channels.fetch(options.roleChannelId);
            const messages = await channel.messages.fetch({
                limit: 10
            });
            let lastMessage = messages.find(msg => msg.webhookId === webhook.id);

            if (!lastMessage) {
                console.error(`Message not found! Making a new one...`);
                lastMessage = await webhook.send({
                    username: "ValhallaMC Role Assignment",
                    content: "Click on buttons below to toggle the roles!",
                });
            }

            let actionRows = [];
            let buttonList = [];
            for (let server of serverList) {

                const channel = await client.channels.fetch(options.roleChannelId);

                let emoji = channel.guild.emojis.cache.find(emoji => emoji.name === server.tag);
                if (!emoji) {
                    await generateEmoji(server);
                    emoji = {};
                    emoji.id = "1068771797878722560";
                }
                let button = new ButtonBuilder()
                    .setCustomId(server.tag)
                    .setLabel(server.name)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emoji.id);
                buttonList.push(button);
            }

            while (buttonList.length > 0) {
                actionRows.push(new ActionRowBuilder().addComponents(buttonList.splice(0, 5)));
            }
            await webhook.editMessage(lastMessage.id, {
                components: actionRows
            });
        }

        async function generateNewRoles(serverList) {
            for (let server of serverList) {
                console.log(`Generating new role for ${server.name}`);
                const channel = await client.channels.fetch(options.roleChannelId);

                const newRole = await channel.guild.roles.create({
                    name: `[${server.tag.toUpperCase()}] ${server.name}`,
                    reason: 'Automated role generation for role assigner.'
                });

                let update = {
                    $set: {
                        discord_role_id: newRole.id
                    }
                };

                await mongo.updateServers(server.modpackID, update);
            }
        }

        async function generateEmoji(server) {
            if (!server.hostname) return;
            const channel = await client.channels.fetch(options.roleChannelId);
            console.log(`Creating new emoji for ${server.name}!`);
            let emojiURL = "";

            if (server.platform === 'feedthebeast') {
                const packData = await getFTBPackData(server.modpackID);
                emojiURL = packData.art[0].url;
            } else {
                const packData = await getPackData(server.modpackID);
                emojiURL = packData.logo.url;
            }
            //FIXME: emoji too big
            //await channel.guild.emojis.create({ attachment: emojiURL, name: server.tag });
        }

        async function addMentionButton(serverList) {
            if (!options.MentionRoleId) return serverList;

            const channel = await client.channels.fetch(options.roleChannelId);

            let role = channel.guild.roles.cache.find(role => role.id === options.MentionRoleId);
            if (!role) return serverList;

            let mentionObj = {
                name: role.name,
                tag: role.name.toLowerCase(),
                discord_role_id: role.id
            };
        
            serverList.unshift(mentionObj);
            return serverList;
        }

        buildButtons();
        setInterval(buildButtons, options.interval * 60 * 1000);
    }

};

