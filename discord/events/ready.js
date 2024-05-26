/*
 * File: ready.js
 * Project: Valhalla-Updater
 * File Created: Friday, 17th May 2024 12:59:37 am
 * Author: flaasz
 * -----
 * Last Modified: Monday, 27th May 2024 1:40:36 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */
const {
    Events
} = require('discord.js');
const {
    deployCommands
} = require('../deploy');
const {
    announcementChannelId,
    staffChannelId
} = require('../../config/config.json').discord;

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        await deployCommands(client.user.id);

        for (let channnelId of [announcementChannelId, staffChannelId, rolesChannelId]) {
            const channel = client.channels.cache.get(channnelId);
            if (!channel) {
                console.error(`Channel with ID ${channnelId} not found!`);
                continue;
            }
            try {
                const webhooks = await channel.fetchWebhooks();
                const webhook = webhooks.find(wh => wh.token);

                if (!webhook) {
                    console.log(`Creating webhook for channel ${channel.name}...`);
                    await channel.createWebhook({
                        name: "Valhalla Updater",
                        avatar: client.user.displayAvatarURL(),
                    });
                    process.stdout.moveCursor(0, -1);
                    console.log(`Creating webhook for channel ${channel.name}... Done!`);
                }
            } catch (error) {
                console.error('Error trying to create a webhook: ', error);
            }
        }
    }
};