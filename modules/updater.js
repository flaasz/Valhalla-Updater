const fs = require('fs');
const archivizer = require('./archivizer');
const comparator = require('./comparator');
const merger = require('./merger');
const extras = require('./extras');
const curseforge = require('./curseforge');
const downloader = require('./downloader');
const pterodactyl = require('./pterodactyl');

let pack = {
    "id": 936875,
    "shortName": "cte2",
    "serverID": "49f7c927",
    "currentVersion": 5113046
};

module.exports = {
    update: async function (pack) {

        /*let newestServerPackID = await curseforge.getLatestServerPackId(pack.id);
        let currentServerPackID = await curseforge.getServerFileId(pack.id, pack.currentVersion);

        let newestServerpackURL = await curseforge.getServerFileLink(pack.id, newestServerPackID);
        let currentServerPackURL = await curseforge.getServerFileLink(pack.id, currentServerPackID);

        if (await fs.existsSync(`./${pack.shortName}`)) {
            await fs.rmSync(`./${pack.shortName}`, { recursive: true, force: true });
        }

        await downloader.download(newestServerpackURL, `./${pack.shortName}/downloads/new/${pack.shortName}_${newestServerPackID}.tar.gz`);
        await downloader.download(currentServerPackURL, `./${pack.shortName}/downloads/old/${pack.shortName}_${currentServerPackID}.tar.gz`);


        await fs.readdirSync(`./${pack.shortName}/downloads/new`).forEach(file => {
            archivizer.decompress(`./${pack.shortName}/downloads/new/${file}`, `./${pack.shortName}/compare/new`);
        });
    
        await extras.checkMods(`./${pack.shortName}/compare/new`);
    
        await fs.readdirSync(`./${pack.shortName}/downloads/old`).forEach(file => {
            archivizer.decompress(`./${pack.shortName}/downloads/old/${file}`, `./${pack.shortName}/compare/old`);
        });
    
        await extras.checkMods(`./${pack.shortName}/compare/old`);*/

        let toCompressList = [];

        /*await fs.readdirSync(`./${pack.shortName}/compare/old`).forEach(file => {
            toCompressList.push(file);
        });

        let compress = await pterodactyl.compressFile(pack.serverID, toCompressList);

        await extras.sleep(30000);

        let downloadLink = await pterodactyl.getDownloadLink(pack.serverID, compress.attributes.name);

        await downloader.download(downloadLink, `./${pack.shortName}/downloads/main/${pack.shortName}_main_${pack.currentVersion}.zip`);*/


        await fs.readdirSync(`./${pack.shortName}/downloads/main`).forEach(file => {
            archivizer.decompress(`./${pack.shortName}/downloads/main/${file}`, `./${pack.shortName}/compare/main`);
        });




        //let customChanges = await comparator.findCustomChanges("./temp", "./compare/old");
        //let changeList = await comparator.compare("./compare/old", "./compare/new");

    
        //console.log(customChanges);
        //await merger.merge(changeList);

        //await archivizer.compressDirectory("./temp", "./out/test.zip");
    }
};