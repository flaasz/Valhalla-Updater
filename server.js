const updater = require("./modules/updater");
const curseforge = require("./modules/curseforge");
const pterodactyl = require("./modules/pterodactyl");
const downloader = require("./modules/downloader");
const manifest = require("./modules/manifest");
const comparator = require("./modules/comparator");
const functions = require("./modules/functions");
require('dotenv').config();

const pack = {
    id: 936875,
    shortName: "cte2",
    serverID: "49f7c927",
    currentVersion: 5113046
};


//updater.update(pack);

let downloadList = [
    {
        "version": "8",
        "path": "./kubejs/server_scripts/",
        "url": "https://dist.modpacks.ch/modpacks/8/FTB%20Skies%20Expert-1.5.0/kubejs/server_scripts/237fac120eec4556ef20e8b0327ee8331db0aa16",
        "mirrors": [],
        "sha1": "237fac120eec4556ef20e8b0327ee8331db0aa16",
        "size": 2253,
        "tags": [],
        "clientonly": false,
        "serveronly": false,
        "optional": false,
        "id": 343274,
        "name": "loot.js",
        "type": "script",
        "updated": 1710619967
    },
    {
        "version": "9",
        "path": "./kubejs/server_scripts/events/",
        "url": "https://dist.modpacks.ch/modpacks/9/FTB%20Skies%20Expert-1.8.0/kubejs/server_scripts/events/93ab663b221c089a056e253dc56b4f0f2a6a11ab",
        "mirrors": [],
        "sha1": "93ab663b221c089a056e253dc56b4f0f2a6a11ab",
        "size": 5172,
        "tags": [],
        "clientonly": false,
        "serveronly": false,
        "optional": false,
        "id": 353858,
        "name": "wanderingtrader.js",
        "type": "script",
        "updated": 1714695528
    },
    {
        "version": "unknown",
        "path": "./mods/",
        "url": "",
        "mirrors": [],
        "sha1": "ba22a39b955573dbfa0a402519a553c80dfbca46",
        "size": 57891,
        "tags": [],
        "clientonly": false,
        "serveronly": false,
        "optional": false,
        "id": 336077,
        "name": "JadeAddons-1.19.2-forge-3.6.2.jar",
        "type": "mod",
        "updated": 1700095201,
        "curseforge": {
            "project": 583345,
            "file": 4850581
        }
    },
    {
        "version": "unknown",
        "path": "./mods/",
        "url": "",
        "mirrors": [],
        "sha1": "3ac2372271e079ed9d560ee8ec4d568269adb6bb",
        "size": 134261,
        "tags": [],
        "clientonly": false,
        "serveronly": false,
        "optional": false,
        "id": 336078,
        "name": "JustEnoughMekanismMultiblocks-1.19.2-3.4.jar",
        "type": "mod",
        "updated": 1700095201,
        "curseforge": {
            "project": 898746,
            "file": 4807868
        }
    },
];

let downloadList1 = [
    {
        "version": "8",
        "path": "./kubejs/server_scripts/",
        "url": "https://dist.modpacks.ch/modpacks/8/FTB%20Skies%20Expert-1.5.0/kubejs/server_scripts/237fac120eec4556ef20e8b0327ee8331db0aa16",
        "mirrors": [],
        "sha1": "237fac120eec4556ef20e8b0327ee8331db0aa16",
        "size": 2253,
        "tags": [],
        "clientonly": false,
        "serveronly": false,
        "optional": false,
        "id": 343274,
        "name": "loot.js",
        "type": "script",
        "updated": 1710619967
    },
    {
        "version": "9",
        "path": "./kubejs/server_scripts/events/",
        "url": "https://dist.modpacks.ch/modpacks/9/FTB%20Skies%20Expert-1.8.0/kubejs/server_scripts/events/93ab663b221c089a056e253dc56b4f0f2a6a11ab",
        "mirrors": [],
        "sha1": "93ab663b221c089a056e253dc56b4f0f2a6a11ab",
        "size": 5171,
        "tags": [],
        "clientonly": false,
        "serveronly": false,
        "optional": false,
        "id": 353858,
        "name": "wanderingtrader.js",
        "type": "script",
        "updated": 1714695528
    },
    {
        "version": "unknown",
        "path": "./mods/",
        "url": "",
        "mirrors": [],
        "sha1": "ba22a39b955573dbfa0a402519a553c80dfbca41",
        "size": 57891,
        "tags": [],
        "clientonly": false,
        "serveronly": false,
        "optional": false,
        "id": 336077,
        "name": "JadeAddons-1.19.2-forge-3.6.0.jar",
        "type": "mod",
        "updated": 1700095201,
        "curseforge": {
            "project": 583345,
            "file": 4850581
        }
    },
    {
        "version": "unknown",
        "path": "./mods/",
        "url": "",
        "mirrors": [],
        "sha1": "3ac2372271e079ed9d560ee8ec4d568269adb6bb",
        "size": 134261,
        "tags": [],
        "clientonly": false,
        "serveronly": false,
        "optional": false,
        "id": 336078,
        "name": "JustEnoughMekanismMultiblocks-1.19.2-3.4.jar",
        "type": "mod",
        "updated": 1700095201,
        "curseforge": {
            "project": 898746,
            "file": 4807868
        }
    },
];

async function abc() {

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

    const versionsList = [
        "GT_New_Horizons_2.5.1",
        "1.8.1",
        "Enigmatica 2 Expert 1.90h",
        "Vault Hunters 3rd Edition-3.13.zip",
        "All the Mods 9-0.2.58",
        "Sky Bees 2 1.4.1 Serverfiles.zip",
        "SteamPunk_ServerPack_v22HF.zip",
        "Craft to Exile 2-0.5.2b.zip",
    ];

    versionsList.forEach(version => {
        console.log(functions.getVersion(version));
    });
    
    //console.log(functions.getVersion("SteamPunk_ServerPack_v22HF.zip"));

}
abc();