/*
 * File: updater.js
 * Project: Valhalla-Updater
 * File Created: Saturday, 11th May 2024 3:52:12 pm
 * Author: flaasz
 * -----
 * Last Modified: Monday, 27th May 2024 1:39:23 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const fs = require('fs');
const {
    decompress,
    compressDirectory
} = require('./compressor');
const comparator = require('./comparator');
const merger = require('./merger');
const {
    sleep,
    checkMods,
    getVersion,
    rmRecursive
} = require('./functions');
const curseforge = require('./curseforge');
const {
    download,
    upload
} = require('./downloader');
const pterodactyl = require('./pterodactyl');
const {
    unpack
} = require('./unpacker');
const modpacksch = require('./modpacksch');
const {
    alertScheduledUpdate
} = require('../config/messages.json');

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
    updateCF: async function (pack, interaction) {

        const packManifest = await modpacksch.getCFPackManifest(pack.modpackID, pack.newestFileID);

        const newVersionNumber = getVersion(packManifest.name);

        const alert = alertScheduledUpdate.replace("[NEWVERSION]", newVersionNumber);

        let progressLog = `Update sequence started for **${pack.name}** (${pack.modpack_version} -> ${newVersionNumber}).`;
        await interaction.followUp(progressLog);

        await pterodactyl.sendCommand(pack.serverId, alert);

        const newestServerPackID = await curseforge.getServerFileId(pack.modpackID, pack.newestFileID);
        const currentServerPackID = await curseforge.getServerFileId(pack.modpackID, pack.fileID);

        const newestServerpackURL = await curseforge.getFileLink(pack.modpackID, newestServerPackID);
        const currentServerPackURL = await curseforge.getFileLink(pack.modpackID, currentServerPackID);

        rmRecursive(`./${pack.tag}`);

        progressLog += `\n- Downloading new server pack...`;
        await interaction.editReply(progressLog);
        await download(newestServerpackURL, `./${pack.tag}/downloads/new/${pack.tag}_${newestServerPackID}.zip`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += ` Done!\n- Downloading reference server pack...`;
        await interaction.editReply(progressLog);
        await download(currentServerPackURL, `./${pack.tag}/downloads/old/${pack.tag}_${currentServerPackID}.zip`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += ` Done!\n- Decompressing new pack files...`;
        await interaction.editReply(progressLog);
        await decompress(`./${pack.tag}/downloads/new/${pack.tag}_${newestServerPackID}.zip`, `./${pack.tag}/compare/new`);
        await checkMods(`./${pack.tag}/compare/new`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += ` Done!\n- Decompressing reference pack files...`;
        await interaction.editReply(progressLog);
        await decompress(`./${pack.tag}/downloads/old/${pack.tag}_${currentServerPackID}.zip`, `./${pack.tag}/compare/old`);
        await checkMods(`./${pack.tag}/compare/old`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        let toCompressList = [];

        await fs.readdirSync(`./${pack.tag}/compare/old`).forEach(file => {
            toCompressList.push(file);
        });

        progressLog += ` Done!\n- Shutting down the server...`;
        await interaction.editReply(progressLog);
        await pterodactyl.shutdown(pack.serverId);

        progressLog += ` Done!\n- Compressing and downloading current server files...`;
        await interaction.editReply(progressLog);
        const compress = await pterodactyl.compressFile(pack.serverId, toCompressList);

        const downloadLink = await pterodactyl.getDownloadLink(pack.serverId, compress);
        await download(downloadLink, `./vault/${pack.tag}/${pack.tag}_main_${pack.fileID}.tar.gz`);

        await sleep(1000);
        await pterodactyl.deleteFile(pack.serverId, [compress]);

        progressLog += ` Done!\n- Unpacking current server files...`;
        await interaction.editReply(progressLog);
        await unpack(`./vault/${pack.tag}/${pack.tag}_main_${pack.fileID}.tar.gz`, `./${pack.tag}/compare/main`);

        progressLog += ` Done!\n- Comparing changes...`;
        await interaction.editReply(progressLog);
        const customChanges = await comparator.findCustomChanges(`./${pack.tag}/compare/main`, `./${pack.tag}/compare/old`);
        const changeList = await comparator.compare(`./${pack.tag}/compare/old`, `./${pack.tag}/compare/new`);

        progressLog += ` Done!\n- **Custom files**: ${customChanges.customFiles.length}, **Missing files**: ${customChanges.missingFiles.length}, **Edited files**: ${customChanges.editedFiles.length}`;
        progressLog += `\n- **Files to delete**: ${changeList.deletions.length}, **Files to add**: ${changeList.additions.length}`;
        const overWrites = customChanges.editedFiles.filter(file => changeList.additions.includes(file));

        let printOverWrite = " ";
        for (let f of overWrites) {
            printOverWrite += `\n - ${f}`;
        }
        progressLog += `\n- **Overwrites**: ${overWrites.length} files: ${printOverWrite}\n`;
        await interaction.editReply(progressLog);

        progressLog += `\n- Merging changes...`;
        await interaction.editReply(progressLog);
        await merger.merge(`./${pack.tag}`, changeList);

        progressLog += ` Done!\n- Compressing merged server pack...`;
        await interaction.editReply(progressLog);
        await compressDirectory(`${pack.tag}/compare/main`, `${pack.tag}/update_${pack.tag}_${pack.newestFileID}.zip`);

        progressLog += ` Done!\n- Uploading compressed update to the server...`;
        await interaction.editReply(progressLog);
        const uploadUrl = await pterodactyl.getUploadLink(pack.serverId);
        await upload(`${pack.tag}/update_${pack.tag}_${pack.newestFileID}.zip`, uploadUrl);


        //DANGER ZONE - LINES BELOW MODIFY THE SERVER FILES ON LIVE BRANCH

        progressLog += ` Done!\n- Unpacking the update...`;
        await interaction.editReply(progressLog);
        await pterodactyl.deleteFile(pack.serverId, toCompressList);
        await pterodactyl.decompressFile(pack.serverId, `update_${pack.tag}_${pack.newestFileID}.zip`);
        await pterodactyl.deleteFile(pack.serverId, [`update_${pack.tag}_${pack.newestFileID}.zip`]);

        //DANGER ZONE - LINES ABOVE MODIFY THE SERVER FILES ON LIVE BRANCH


        progressLog += ` Done!\n- Starting the server...`;
        await interaction.editReply(progressLog);
        await pterodactyl.sendPowerAction(pack.serverId, "start");

        progressLog += ` Done!\n- Update sequence completed. Cleaning up...`;
        await interaction.editReply(progressLog);
        rmRecursive(`./${pack.tag}`);
    },

    updateFTB: async function (pack) {
        //TODO ftbupdater sequence
    }
    //TODO gregtech updater sequence
};