/*
 * File: updateManager.js
 * Project: valhalla-updater
 * File Created: Saturday, 11th May 2024 3:52:12 pm
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 1st June 2024 1:17:37 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const fs = require('fs');
const {
    decompress,
    compressDirectory
} = require('../modules/compressor');
const comparator = require('../modules/comparator');
const merger = require('../modules/merger');
const {
    sleep,
    checkMods,
    getVersion,
    rmRecursive
} = require('../modules/functions');
const curseforge = require('../modules/curseforge');
const {
    download,
    upload
} = require('../modules/downloader');
const pterodactyl = require('../modules/pterodactyl');
const {
    unpack
} = require('../modules/unpacker');
const modpacksch = require('../modules/modpacksch');
const {
    alertScheduledUpdate,
    updateMessage
} = require('../config/messages.json');
const mongo = require('../modules/mongo');
const {
    sendWebhook
} = require('../discord/webhook');
const manifest = require('../modules/manifest');
const {
    active,
    announcementChannelId
} = require("../config/config.json").discord;

let newpack = { //reference
    //_id: new ObjectId('6638d513fb984056c222f480'),
    hostname: '',
    port: 10004,
    tag: 'ske',
    desc: '',
    discord_role_id: '',
    name: 'FTB Skies Expert',
    server_version: '1.19.2',
    modpack_version: '1.8.1',
    genre: '',
    early_access: false,
    color: 'blue',
    serverId: 'asdadas',
    image: '',
    rtp_max_range: '10000',
    rtp_min_range: '250',
    modpackID: 117,
    fileID: 11927,
    rtp_cooldown: '600',
    newestFileID: 11927,
    platform: 'feedthebeast',
    requiresUpdate: false
};

module.exports = {

    /**
     * Updates the server with the latest version of the modpack. (CurseForge)
     * @param {object} pack Object with the server data.
     * @param {object} interaction Object with the interaction data.(for Discord)
     */

    updateCF: async function (pack, interaction) {

        const packManifest = await modpacksch.getCFPackManifest(pack.modpackID, pack.newestFileID);

        const newVersionNumber = getVersion(packManifest.name);

        const alert = alertScheduledUpdate.replace("[NEWVERSION]", newVersionNumber);

        let progressLog = `Update sequence started for **${pack.name}** (${pack.modpack_version} -> ${newVersionNumber}).`;
        await interaction.edit(progressLog);

        await pterodactyl.sendCommand(pack.serverId, alert);

        const newestServerPackID = await curseforge.getServerFileId(pack.modpackID, pack.newestFileID);
        const currentServerPackID = await curseforge.getServerFileId(pack.modpackID, pack.fileID);

        const newestServerpackURL = await curseforge.getFileLink(pack.modpackID, newestServerPackID);
        const currentServerPackURL = await curseforge.getFileLink(pack.modpackID, currentServerPackID);

        rmRecursive(`./${pack.tag}`);

        progressLog += `\n- Downloading new server pack...`;
        await interaction.edit(progressLog);
        await download(newestServerpackURL, `./${pack.tag}/downloads/new/${pack.tag}_${newestServerPackID}.zip`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += ` Done!\n- Downloading reference server pack...`;
        await interaction.edit(progressLog);
        await download(currentServerPackURL, `./${pack.tag}/downloads/old/${pack.tag}_${currentServerPackID}.zip`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += ` Done!\n- Decompressing new pack files...`;
        await interaction.edit(progressLog);
        await decompress(`./${pack.tag}/downloads/new/${pack.tag}_${newestServerPackID}.zip`, `./${pack.tag}/compare/new`);
        await checkMods(`./${pack.tag}/compare/new`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += ` Done!\n- Decompressing reference pack files...`;
        await interaction.edit(progressLog);
        await decompress(`./${pack.tag}/downloads/old/${pack.tag}_${currentServerPackID}.zip`, `./${pack.tag}/compare/old`);
        await checkMods(`./${pack.tag}/compare/old`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        let toCompressList = [];

        await fs.readdirSync(`./${pack.tag}/compare/old`).forEach(file => {
            toCompressList.push(file);
        });

        progressLog += ` Done!\n- Shutting down the server...`;
        await interaction.edit(progressLog);
        await pterodactyl.shutdown(pack.serverId);

        progressLog += ` Done!\n- Compressing and downloading current server files...`;
        await interaction.edit(progressLog);
        const compress = await pterodactyl.compressFile(pack.serverId, toCompressList);

        const downloadLink = await pterodactyl.getDownloadLink(pack.serverId, compress);
        await download(downloadLink, `./vault/${pack.tag}/${pack.tag}_${pack.modpack_version}_${pack.fileID}.tar.gz`);

        await sleep(1000);
        await pterodactyl.deleteFile(pack.serverId, [compress]);

        progressLog += ` Done!\n- Unpacking current server files...`;
        await interaction.edit(progressLog);
        await unpack(`./vault/${pack.tag}/${pack.tag}_${pack.modpack_version}_${pack.fileID}.tar.gz`, `./${pack.tag}/compare/main`);

        progressLog += ` Done!\n- Comparing changes...`;
        await interaction.edit(progressLog);
        const customChanges = await comparator.findCustomChanges(`./${pack.tag}/compare/main`, `./${pack.tag}/compare/old`);
        const changeList = await comparator.compare(`./${pack.tag}/compare/old`, `./${pack.tag}/compare/new`);

        progressLog += ` Done!\n- **Custom files**: ${customChanges.customFiles.length}, **Missing files**: ${customChanges.missingFiles.length}, **Edited files**: ${customChanges.editedFiles.length}`;
        progressLog += `\n- **Files to delete**: ${changeList.deletions.length}, **Files to add**: ${changeList.additions.length}`;
        const overWrites = customChanges.editedFiles.filter(file => changeList.additions.includes(file));

        let printOverWrite = " ";
        for (let f of overWrites) {
            printOverWrite += `\n - ${f}`;
        }
        progressLog += `\n- **Overwrites**: ${overWrites.length} files: ${printOverWrite}`;
        await interaction.edit(progressLog);

        progressLog += `\n- Merging changes...`;
        await interaction.edit(progressLog);
        await merger.merge(`./${pack.tag}`, changeList);

        progressLog += ` Done!\n- Compressing merged server pack...`;
        await interaction.edit(progressLog);
        await compressDirectory(`${pack.tag}/compare/main`, `${pack.tag}/update_${pack.tag}_${pack.newestFileID}.zip`);

        progressLog += ` Done!\n- Uploading compressed update to the server...`;
        await interaction.edit(progressLog);
        const uploadUrl = await pterodactyl.getUploadLink(pack.serverId);
        await upload(`${pack.tag}/update_${pack.tag}_${pack.newestFileID}.zip`, uploadUrl);


        //DANGER ZONE - LINES BELOW MODIFY THE SERVER FILES ON LIVE BRANCH

        progressLog += ` Done!\n- Unpacking the update...`;
        await interaction.edit(progressLog);
        await pterodactyl.deleteFile(pack.serverId, toCompressList);
        await sleep(1000);
        await pterodactyl.decompressFile(pack.serverId, `update_${pack.tag}_${pack.newestFileID}.zip`);
        await sleep(1000);
        await pterodactyl.deleteFile(pack.serverId, [`update_${pack.tag}_${pack.newestFileID}.zip`]);

        //DANGER ZONE - LINES ABOVE MODIFY THE SERVER FILES ON LIVE BRANCH


        progressLog += ` Done!\n- Starting the server...`;
        await interaction.edit(progressLog);
        await pterodactyl.sendPowerAction(pack.serverId, "start");

        progressLog += ` Done!\n- Update sequence completed. Cleaning up...`;
        await interaction.edit(progressLog);
        rmRecursive(`./${pack.tag}`);

        progressLog += ` Done!\n- Updating data and sending update message...`;
        await interaction.edit(progressLog);
        let dbUpdate = {
            $set: {
                modpack_version: newVersionNumber,
                fileID: pack.newestFileID,
                newestFileID: pack.newestFileID,
                requiresUpdate: false
            }
        };
        mongo.updateServer(pack.serverId, dbUpdate);

        //TODO ai summary ???
        const packData = await curseforge.getPackData(pack.modpackID);
        const updateMessageContent = updateMessage.replace("[PACKNAME]", pack.name)
            .replace("[NEWVERSION]", newVersionNumber)
            .replace("[OLDVERSION]", pack.modpack_version)
            .replace("[CHANGELOGURL]", `https://www.curseforge.com/minecraft/modpacks/${packData.slug}/files/${pack.newestFileID}`)
            .replace("[PINGROLE]", `<@&${pack.discord_role_id}>`)
            .replace("[SUMMARY]", "");

        const updateWebhook = {
            content: updateMessageContent,
            username: pack.name,
            avatarURL: packData.logo.url,
        };

        await sendWebhook(announcementChannelId, updateWebhook);

    },

    /**
     * Updates the server with the latest version of the modpack. (Feed The Beast)
     * @param {object} pack Object with the server data.
     * @param {object} interaction Object with the interaction data.(for Discord)
     */
    updateFTB: async function (pack, interaction) {
        const newManifest = await modpacksch.getFTBPackManifest(pack.modpackID, pack.newestFileID);

        const newVersionNumber = getVersion(newManifest.name);

        const alert = alertScheduledUpdate.replace("[NEWVERSION]", newVersionNumber);

        let progressLog = `Update sequence started for **${pack.name}** (${pack.modpack_version} -> ${newVersionNumber}).`;
        await interaction.edit(progressLog);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += `\n- Getting pack manifests...`;
        await interaction.edit(progressLog);


        const oldManifest = await modpacksch.getFTBPackManifest(pack.modpackID, pack.fileID);

        rmRecursive(`./${pack.tag}`);
        
        await pterodactyl.sendCommand(pack.serverId, alert);

        let toCompressList = [];
        for (let file of oldManifest.files) {
            if (file.path === "./") toCompressList.push(file.name);
            const match = file.path.match(/\/([^/]+)/);
            const path = match ? match[1] : null;
            if (!toCompressList.includes(path) && path != null) toCompressList.push(path);
        }

        await sleep(5000);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += ` Done!\n- Shutting down the server...`;
        await interaction.edit(progressLog);
        await pterodactyl.shutdown(pack.serverId);

        progressLog += ` Done!\n- Compressing and downloading current server files...`;
        await interaction.edit(progressLog);
        const compress = await pterodactyl.compressFile(pack.serverId, toCompressList);
        
        const downloadLink = await pterodactyl.getDownloadLink(pack.serverId, compress);
        await download(downloadLink, `./vault/${pack.tag}/${pack.tag}_${pack.modpack_version}_${pack.fileID}.tar.gz`);

        await sleep(1000);
        await pterodactyl.deleteFile(pack.serverId, [compress]);

        progressLog += ` Done!\n- Unpacking current server files...`;
        await interaction.edit(progressLog);
        await unpack(`./vault/${pack.tag}/${pack.tag}_${pack.modpack_version}_${pack.fileID}.tar.gz`, `./${pack.tag}/compare/main`);

        progressLog += ` Done!\n- Generating current server manifest...`;
        await interaction.edit(progressLog);

        const currentManifest = await manifest.generate(`./${pack.tag}/compare/main`);

        progressLog += ` Done!\n- Comparing changes...`;
        await interaction.edit(progressLog);

        const oldFilelist = oldManifest.files.filter(obj => !obj.clientonly);
        const newFilelist = newManifest.files.filter(obj => !obj.clientonly);

        const customChanges = await comparator.findCustomManifestChanges(currentManifest, oldFilelist);
        const changeList = await comparator.findManifestChanges(oldFilelist, newFilelist);
        
        progressLog += ` Done!\n- **Custom files**: ${customChanges.customFiles.length}, **Missing files**: ${customChanges.missingFiles.length}, **Edited files**: ${customChanges.editedFiles.length}`;
        progressLog += `\n- **Files to delete**: ${changeList.deletions.length}, **Files to add**: ${changeList.additions.length}`;
        const overWrites = customChanges.editedFiles.filter(file => changeList.additions.includes(file));

        let printOverWrite = " ";
        for (let f of overWrites) {
            printOverWrite += `\n - ${f}`;
        }
        progressLog += `\n- **Overwrites**: ${overWrites.length} files: ${printOverWrite}`;
        await interaction.edit(progressLog);

        progressLog += `\n- Merging changes...`;
        await interaction.edit(progressLog);

        await merger.mergeFromManifest(`./${pack.tag}/compare/main`, changeList, newManifest);

        progressLog += ` Done!\n- Compressing merged server pack...`;
        await interaction.edit(progressLog);
        await compressDirectory(`${pack.tag}/compare/main`, `${pack.tag}/update_${pack.tag}_${pack.newestFileID}.zip`);

        progressLog += ` Done!\n- Uploading compressed update to the server...`;
        await interaction.edit(progressLog);
        const uploadUrl = await pterodactyl.getUploadLink(pack.serverId);
        await upload(`${pack.tag}/update_${pack.tag}_${pack.newestFileID}.zip`, uploadUrl);


        //DANGER ZONE - LINES BELOW MODIFY THE SERVER FILES ON LIVE BRANCH

        progressLog += ` Done!\n- Unpacking the update...`;
        await interaction.edit(progressLog);
        await pterodactyl.deleteFile(pack.serverId, toCompressList);
        await sleep(1000);
        await pterodactyl.decompressFile(pack.serverId, `update_${pack.tag}_${pack.newestFileID}.zip`);
        await sleep(1000);
        await pterodactyl.deleteFile(pack.serverId, [`update_${pack.tag}_${pack.newestFileID}.zip`]);

        //DANGER ZONE - LINES ABOVE MODIFY THE SERVER FILES ON LIVE BRANCH


        progressLog += ` Done!\n- Starting the server...`;
        await interaction.edit(progressLog);
        await pterodactyl.sendPowerAction(pack.serverId, "start");

        progressLog += ` Done!\n- Update sequence completed. Cleaning up...`;
        await interaction.edit(progressLog);
        rmRecursive(`./${pack.tag}`);

        progressLog += ` Done!\n- Updating data and sending update message...`;
        await interaction.edit(progressLog);
        let dbUpdate = {
            $set: {
                modpack_version: newVersionNumber,
                fileID: pack.newestFileID,
                newestFileID: pack.newestFileID,
                requiresUpdate: false
            }
        };
        await mongo.updateServer(pack.serverId, dbUpdate);

        //TODO ai summary ???
        const packData = await modpacksch.getFTBPackData(pack.modpackID);
        const updateMessageContent = updateMessage.replace("[PACKNAME]", pack.name)
            .replace("[NEWVERSION]", newVersionNumber)
            .replace("[OLDVERSION]", pack.modpack_version)
            .replace("[CHANGELOGURL]", `https://www.feed-the-beast.com/modpacks/${pack.modpackID}?tab=versions`)
            .replace("[PINGROLE]", `<@&${pack.discord_role_id}>`)
            .replace("[SUMMARY]", "");

        const updateWebhook = {
            content: updateMessageContent,
            username: pack.name,
            avatarURL: packData.art[0].url,
        };

        await sendWebhook(announcementChannelId, updateWebhook);
    },

    /**
     * Restores an update from the list of available versions. Pterodactyl has trouble unpacking tar.gz files, so it repacks the backup to a zip file first.
     * @param {object} pack Object containing the server data.
     * @param {string} backup The backup file to restore from.
     * @param {object} interaction Object containing the interaction data. (for Discord)
     */
    restore: async function (pack, backup, interaction) {

        let restoredPackData = backup.match(/^.+?_(.+)_(.+)\.tar\.gz$/);

        let progressLog = `Restore sequence started for **${pack.name}** (${pack.modpack_version} -> ${restoredPackData[1]}).`;
        await interaction.edit(progressLog);

        progressLog += `\n- Shutting down the server...`;
        await interaction.edit(progressLog);
        await pterodactyl.shutdown(pack.serverId);

        progressLog += ` Done!\n- Repacking backup to zip...`;
        await interaction.edit(progressLog);
        await unpack(`./vault/${pack.tag}/${pack.tag}_${restoredPackData[1]}_${restoredPackData[2]}.tar.gz`, `./${pack.tag}/backup`);

        await compressDirectory(`${pack.tag}/backup`, `${pack.tag}/${pack.tag}_${restoredPackData[1]}_${restoredPackData[2]}.zip`);

        progressLog += ` Done!\n- Uploading backup to the server...`;
        await interaction.edit(progressLog);
        const uploadUrl = await pterodactyl.getUploadLink(pack.serverId);
        await upload(`${pack.tag}/${pack.tag}_${restoredPackData[1]}_${restoredPackData[2]}.zip`, uploadUrl);

        progressLog += ` Done!\n- Deleting update files...`;
        await interaction.edit(progressLog);

        let toDeleteList = [];
        
        await fs.readdirSync(`./${pack.tag}/backup`).forEach(file => {
            toDeleteList.push(file);
        });

        // DANGER ZONE - LINES BELOW MODIFY THE SERVER FILES ON LIVE BRANCH
        
        await pterodactyl.deleteFile(pack.serverId, toDeleteList);
        await sleep(1000);

        progressLog += ` Done!\n- Unpacking the backup...`;
        await interaction.edit(progressLog);

        await pterodactyl.decompressFile(pack.serverId, `${pack.tag}_${restoredPackData[1]}_${restoredPackData[2]}.zip`);
        await sleep(1000);
        await pterodactyl.deleteFile(pack.serverId, [`${pack.tag}_${restoredPackData[1]}_${restoredPackData[2]}.zip`]);

        // DANGER ZONE - LINES ABOVE MODIFY THE SERVER FILES ON LIVE BRANCH

        /*progressLog += ` Done!\n- Starting the server...`;
        await interaction.edit(progressLog);

        await pterodactyl.sendPowerAction(pack.serverId, "start");*/
        rmRecursive(`./${pack.tag}`);

        progressLog += ` Done!\n- Restore sequence completed. Updating data...`;
        await interaction.edit(progressLog);

        let dbUpdate = {
            $set: {
                modpack_version: restoredPackData[1],
                fileID: restoredPackData[2],
                requiresUpdate: true
            }
        };
        await mongo.updateServer(pack.serverId, dbUpdate);

    }
    //TODO gregtech updater sequence
};