const fs = require('fs');
const { decompress } = require('./compressor');
const comparator = require('./comparator');
const merger = require('./merger');
const { sleep, checkMods } = require('./functions');
const curseforge = require('./curseforge');
const { download } = require('./downloader');
const pterodactyl = require('./pterodactyl');
const { unpack } = require('./unpacker');

let pack = { // reference 
    id: 936875,
    shortName: "cte2",
    serverID: "49f7c927",
    currentVersion: 5113046,
    requiresUpdate: true,
    platform: "curseforge"
};

module.exports = {
    update: async function (pack) {

        let newestServerPackID = await curseforge.getLatestServerPackId(pack.id);
        let currentServerPackID = await curseforge.getServerFileId(pack.id, pack.currentVersion);

        let newestServerpackURL = await curseforge.getServerFileLink(pack.id, newestServerPackID);
        let currentServerPackURL = await curseforge.getServerFileLink(pack.id, currentServerPackID);

        if (await fs.existsSync(`./${pack.shortName}`)) {
            await fs.rmSync(`./${pack.shortName}`, { recursive: true, force: true });
        }

        await download(newestServerpackURL, `./${pack.shortName}/downloads/new/${pack.shortName}_${newestServerPackID}.tar.gz`);
        await download(currentServerPackURL, `./${pack.shortName}/downloads/old/${pack.shortName}_${currentServerPackID}.tar.gz`);


        await decompress(`./${pack.shortName}/downloads/new/${pack.shortName}_${newestServerPackID}.tar.gz`, `./${pack.shortName}/compare/new`);
        await checkMods(`./${pack.shortName}/compare/new`);
    
        await decompress(`./${pack.shortName}/downloads/old/${pack.shortName}_${currentServerPackID}.tar.gz`, `./${pack.shortName}/compare/old`);
        await checkMods(`./${pack.shortName}/compare/old`);

        let toCompressList = [];

        await fs.readdirSync(`./${pack.shortName}/compare/old`).forEach(file => {
            toCompressList.push(file);
        });

        await pterodactyl.shutdown(pack.serverID);

        let compress = await pterodactyl.compressFile(pack.serverID, toCompressList);

        //await sleep(30000);

        let downloadLink = await pterodactyl.getDownloadLink(pack.serverID, compress);

        //change this location to ./vault/packname/blabla for safekeeping
        await download(downloadLink, `./${pack.shortName}/downloads/main/${pack.shortName}_main_${pack.currentVersion}.tar.gz`);

        await sleep(1000);
        await pterodactyl.deleteFile(pack.serverID, [compress]);

        await unpack(`./${pack.shortName}/downloads/main/${pack.shortName}_main_${pack.currentVersion}.tar.gz`, `./${pack.shortName}/compare/main`);


        let customChanges = await comparator.findCustomChanges(`./${pack.shortName}/compare/main`, `./${pack.shortName}/compare/old`);
        let changeList = await comparator.compare(`./${pack.shortName}/compare/old`, `./${pack.shortName}/compare/new`);

        console.log(changeList);
        console.log(customChanges);
        //await merger.merge(changeList);

        //await compressDirectory("./temp", "./out/test.zip");
    },

    updateFTB: async function (pack) {

    }
};