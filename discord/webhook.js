/*
 * File: webhook.js
 * Project: valhalla-updater
 * File Created: Monday, 27th May 2024 7:31:16 pm
 * Author: flaasz
 * -----
 * Last Modified: Wednesday, 29th May 2024 7:41:03 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const { getClient } = require('./bot');

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

        let webhook = this.getWebhook(channelId);

        webhook.send(message);
    },

    getWebhook: async function(channelId) {
        const client = await getClient();
        const channel = client.channels.cache.get(channelId);

        if (!channel) {
            console.error(`Channel with ID ${channelId} not found!`);
            return;
        }
        try {
            const webhooks = await channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.token);

            if (!webhook) {
                console.log(`Creating webhook for channel ${channel.name}...`);
                webhook = await channel.createWebhook({
                    name: "Valhalla Updater",
                    avatar: client.user.displayAvatarURL(),
                });
                process.stdout.moveCursor(0, -1);
                console.log(`Creating webhook for channel ${channel.name}... Done!`);
            }

            return webhook;

        } catch (error) {
            console.error('Error trying to create a webhook: ', error);
        }
    }
};