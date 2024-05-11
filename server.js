const updater = require("./modules/updater");
const curseforge = require("./modules/curseforge");
const pterodactyl = require("./modules/pterodactyl");
const downloader = require("./modules/downloader");
require('dotenv').config();

const pack = {
    id: 936875,
    shortName: "cte2",
    serverID: "49f7c927",
    currentVersion: 5113046
};


updater.update(pack);

async function abc() {

    //let packData = await curseforge.getLatestServerPackId(pack.id);
    //console.log(packData);
    //let compress = await pterodactyl.compressFile("49f7c927", ["defaultconfigs", "config", "eula.txt"]);
    //console.log(compress);
    //let downloadLink = await pterodactyl.getUploadLink("49f7c927");
    //console.log(downloadLink);
    //downloader.upload("./downloads/cte2.tar.gz", downloadLink);
    //downloader.download("https://edge.forgecdn.net/files/5113/792/Craft%20to%20Exile%202%20SERVER-0.5.2b.zip", "./downloads/cte2.tar.gz");
    //let status = await pterodactyl.getStatus("49f7c927");
    //console.log(status);
}
abc();