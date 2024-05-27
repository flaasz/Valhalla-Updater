/*
 * File: send.js
 * Project: Valhalla-Updater
 * File Created: Monday, 27th May 2024 7:31:16 pm
 * Author: flaasz
 * -----
 * Last Modified: Monday, 27th May 2024 7:54:48 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const { getClient } = require('../discord/bot');

module.exports = {
    /**
     * Sends a webhook message to the specified channel.
     * @param {String} channelId Id of the channel.
     * @param {object} message Object containing the message to send.
     * @returns 
     */
    sendWebhook: async function (channelId, message) {
        const client = await getClient();
        const channel = client.channels.cache.get(channelId);

        if (!channel) {
            console.error(`Channel with ID ${channelId} not found!`);
            return;
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

            webhook.send(message);

        } catch (error) {
            console.error('Error trying to create a webhook: ', error);
        }
    }
};