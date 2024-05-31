/*
 * File: checkForUpdates.js
 * Project: valhalla-updater
 * File Created: Monday, 27th May 2024 8:27:53 pm
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 1st June 2024 1:15:58 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const curseforge = require("../modules/curseforge");
const modpacksch = require("../modules/modpacksch");
const mongo = require("../modules/mongo");
const functions = require("../modules/functions");
const {
    EmbedBuilder
} = require("discord.js");
const {
    sendWebhook
} = require("../discord/webhook");
const {
    active,
    staffChannelId
} = require("../config/config.json").discord;

module.exports = {
    name: 'checkForUpdates',
    defaultConfig: {
        "active": true,
        "interval": 6
    },

    /**
     * Starts a scheduler that checks for modpack updates at a specified interval.
     * @param {object} options Object containing options for the scheduler.
     */
    start: async function (options) {
        async function updateCheck() {
            console.log("Checking for updates...");

            let servers = await mongo.getServers();

            for (let server of servers) {
                let newestUpdateId = 0;
                let updateRequired = false;
                let packManifest = {};
                let packData = {};
                let packURL = "";
                let packLogo = "";

                if (server.platform === "curseforge" || server.platform === "gregtechnewhorizons") {
                    newestUpdateId = await curseforge.getLatestVersionId(server.modpackID);
                    packManifest = await modpacksch.getCFPackManifest(server.modpackID, newestUpdateId);
                    packData = await curseforge.getPackData(server.modpackID);
                    packLogo = packData.logo.url;
                    packURL = `https://www.curseforge.com/minecraft/modpacks/${packData.slug}/files/${newestUpdateId}`;
                }

                if (server.platform === "feedthebeast") {
                    newestUpdateId = await modpacksch.getLatestFTBVersionId(server.modpackID);
                    packManifest = await modpacksch.getFTBPackManifest(server.modpackID, newestUpdateId);
                    packData = await modpacksch.getFTBPackData(server.modpackID);
                    packLogo = packData.art[0].url;
                    packURL = `https://www.feed-the-beast.com/modpacks/${server.modpackID}?tab=versions`;
                }

                if (server.fileID === newestUpdateId) {
                    console.log(`No updates found for ${server.name}.`);
                } else {
                    const newVersionNumber = functions.getVersion(packManifest.name);

                    console.log(`Update found for ${server.name}! (v${server.modpack_version} -> v${newVersionNumber})`);
                    updateRequired = true;

                    if (active && server.newestFileID != newestUpdateId) {
                        const embed = new EmbedBuilder()
                            .setAuthor({
                                name: server.name,
                                iconURL: packLogo,
                            })
                            .setTitle("<a:Update:1242446803345866883><a:U_:1242446802083385426><a:pd:1242446800586280960><a:ate:1242446799093104650>")
                            .setDescription(`An update was detected for ${server.name}! (v${server.modpack_version} -> v${newVersionNumber})\n\nLearn more here: [Changelog](${packURL})`)
                            .setColor("#00f597")
                            .setFooter({
                                text: "To run automated update use /update",
                            })
                            .setTimestamp();
                        const updateWebhook = {
                            embeds: [embed],
                        };

                        await sendWebhook(staffChannelId, updateWebhook);
                    }
                }

                let update = {
                    $set: {
                        newestFileID: newestUpdateId,
                        requiresUpdate: updateRequired
                    }
                };

                await mongo.updateServers(server.modpackID, update);
                //console.log(newestUpdateId);
            }
        }

        //updateCheck();
        setInterval(updateCheck, options.interval * 60 * 60 * 1000);
    }
};