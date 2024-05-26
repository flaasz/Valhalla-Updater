/*
 * File: server.js
 * Project: Valhalla-Updater
 * File Created: Saturday, 11th May 2024 6:17:20 pm
 * Author: flaasz
 * -----
 * Last Modified: Monday, 27th May 2024 1:42:00 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */
const updater = require("./modules/updater");
const curseforge = require("./modules/curseforge");
const pterodactyl = require("./modules/pterodactyl");
const downloader = require("./modules/downloader");
const manifest = require("./modules/manifest");
const comparator = require("./modules/comparator");
const functions = require("./modules/functions");
const mongo = require("./modules/mongo");
const scheduler = require("./modules/scheduler");
const modpacksch = require("./modules/modpacksch");
const discord = require("./discord/bot");
const tabConfigGen = require("./modules/tabConfigGen");
require('dotenv').config();

//updater.update(pack);

async function main() {

    /*let packData = await curseforge.getLatestServerPackId(pack.id);
    console.log(packData);
    let compress = await pterodactyl.shutdown("219d9e28");
    console.log(compress);
    let downloadLink = await pterodactyl.getUploadLink("49f7c927");
    console.log(downloadLink);
    downloader.upload("./downloads/cte2.tar.gz", downloadLink);
    downloader.download("https://edge.forgecdn.net/files/5113/792/Craft%20to%20Exile%202%20SERVER-0.5.2b.zip", "./downloads/cte2.tar.gz");
    let status = await pterodactyl.getStatus("49f7c927");
    console.log(status);

    pterodactyl.shutdown("49f7c927");*/

    //let manif = await manifest.generate("./compare/new/");
    //console.log(manif);

    //await downloader.downloadList(downloadList, "./downloads/test");
    //pterodactyl.shutdown("49f7c927");

    //let comparison = await comparator.compareManifest(downloadList1, downloadList);
    
    //console.log(functions.getVersion("SteamPunk_ServerPack_v22HF.zip"));

    //scheduler.cakeDrop();

    //scheduler.checkForUpdates();

    discord.launchBot();

    //tabConfigGen.generateTabConfig();

    //console.log(await modpacksch.getLatestFTBVersionId(117));

}
main();