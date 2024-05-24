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
const { alertScheduledUpdate } = require('../config/messages.json');

let newpack = {  //reference
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

        let packManifest = await modpacksch.getCFPackManifest(pack.modpackID, pack.newestFileID);

        let newVersionNumber = getVersion(packManifest.name);

        let alert = alertScheduledUpdate.replace("[NEWVERSION]", newVersionNumber);

        let progressLog = `Update sequence started for **${pack.name}** (${pack.modpack_version} -> ${newVersionNumber}).`;
        await interaction.followUp(progressLog);

        await pterodactyl.sendCommand(pack.serverId, alert);

        let newestServerPackID = await curseforge.getServerFileId(pack.modpackID,pack.newestFileID);
        let currentServerPackID = await curseforge.getServerFileId(pack.modpackID, pack.fileID);

        let newestServerpackURL = await curseforge.getFileLink(pack.modpackID, newestServerPackID);
        let currentServerPackURL = await curseforge.getFileLink(pack.modpackID, currentServerPackID);

        rmRecursive(`./${pack.tag}`);

        progressLog += `\n- Downloading new server pack...`;
        await interaction.editReply(progressLog);
        await download(newestServerpackURL, `./${pack.tag}/downloads/new/${pack.tag}_${newestServerPackID}.zip`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += `\n- Downloading reference server pack...`;
        await interaction.editReply(progressLog);
        await download(currentServerPackURL, `./${pack.tag}/downloads/old/${pack.tag}_${currentServerPackID}.zip`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += `\n- Decompressing new pack files...`;
        await interaction.editReply(progressLog);
        await decompress(`./${pack.tag}/downloads/new/${pack.tag}_${newestServerPackID}.zip`, `./${pack.tag}/compare/new`);
        await checkMods(`./${pack.tag}/compare/new`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        progressLog += `\n- Decompressing reference pack files...`;
        await interaction.editReply(progressLog);
        await decompress(`./${pack.tag}/downloads/old/${pack.tag}_${currentServerPackID}.zip`, `./${pack.tag}/compare/old`);
        await checkMods(`./${pack.tag}/compare/old`);

        await pterodactyl.sendCommand(pack.serverId, alert);

        let toCompressList = [];

        await fs.readdirSync(`./${pack.tag}/compare/old`).forEach(file => {
            toCompressList.push(file);
        });

        progressLog += `\n- Shutting down the server...`;
        await interaction.editReply(progressLog);
        await pterodactyl.shutdown(pack.serverId);

        progressLog += `\n- Compressing current server files...`;
        await interaction.editReply(progressLog);
        let compress = await pterodactyl.compressFile(pack.serverId, toCompressList);

        progressLog += `\n- Downloading current pack files from the server...`;
        await interaction.editReply(progressLog);
        let downloadLink = await pterodactyl.getDownloadLink(pack.serverId, compress);

        await download(downloadLink, `./vault/${pack.tag}/${pack.tag}_main_${pack.fileID}.tar.gz`);

        await sleep(1000);
        await pterodactyl.deleteFile(pack.serverId, [compress]);

        progressLog += `\n- Unpacking current server files...`;
        await interaction.editReply(progressLog);
        await unpack(`./vault/${pack.tag}/${pack.tag}_main_${pack.fileID}.tar.gz`, `./${pack.tag}/compare/main`);

        progressLog += `\n- Comparing changes...`;
        await interaction.editReply(progressLog);
        let customChanges = await comparator.findCustomChanges(`./${pack.tag}/compare/main`, `./${pack.tag}/compare/old`);
        let changeList = await comparator.compare(`./${pack.tag}/compare/old`, `./${pack.tag}/compare/new`);

        progressLog += `\n- **Custom files**: ${customChanges.customFiles.length}, **Missing files**: ${customChanges.missingFiles.length}, **Edited files**: ${customChanges.editedFiles.length}`;
        progressLog += `\n- **Files to delete**: ${changeList.deletions.length}, **Files to add**: ${changeList.additions.length}`;
        const overWrites = customChanges.editedFiles.filter(file => changeList.additions.includes(file));

        let printOverWrite = " ";
        for (let f of overWrites) {
            printOverWrite+= `\n - ${f}`;
        }
        progressLog += `\n- **Overwrites**: ${overWrites.length} files: ${printOverWrite}\n`;
        await interaction.editReply(progressLog);

        progressLog += `\n- Merging changes...`;
        await interaction.editReply(progressLog);
        await merger.merge(`./${pack.tag}`, changeList);

        progressLog += `\n- Compressing merged server pack...`;
        await interaction.editReply(progressLog);
        await compressDirectory(`${pack.tag}/compare/main`, `${pack.tag}/update_${pack.tag}_${pack.newestFileID}.zip`);

        progressLog += `\n- Uploading compressed update to the server...`;
        await interaction.editReply(progressLog);
        let uploadUrl = await pterodactyl.getUploadLink(pack.serverId);
        await upload(`${pack.tag}/update_${pack.tag}_${pack.newestFileID}.zip`, uploadUrl);


        //DANGER ZONE - LINES BELOW MODIFY THE SERVER FILES ON LIVE BRANCH

        progressLog += `\n- Unpacking the update...`;
        await interaction.editReply(progressLog);
        await pterodactyl.deleteFile(pack.serverId, toCompressList);
        await pterodactyl.decompressFile(pack.serverId, `update_${pack.tag}_${pack.newestFileID}.zip`);
        await pterodactyl.deleteFile(pack.serverId, [`update_${pack.tag}_${pack.newestFileID}.zip`]);

        //DANGER ZONE - LINES ABOVE MODIFY THE SERVER FILES ON LIVE BRANCH
        

        progressLog += `\n- Starting the server...`;
        await interaction.editReply(progressLog);
        await pterodactyl.sendPowerAction(pack.serverId, "start");

        progressLog += `\n- Update sequence completed. Cleaning up...`;
        await interaction.editReply(progressLog);
        rmRecursive(`./${pack.tag}`);
    },

    updateFTB: async function (pack) {
        //TODO ftbupdater sequence
    }
};