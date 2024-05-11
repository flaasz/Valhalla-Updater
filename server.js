const fs = require('fs');
const archivizer = require('./modules/archivizer');
const comparator = require('./modules/comparator');
const merger = require('./modules/merger');
const extras = require('./modules/extras');



//compare old and new updates
async function begin() {

    await fs.rmSync("./compare", { //cleanup first 
        recursive: true,
        force: true
    });

    await fs.readdirSync("./current").forEach(file => {
        archivizer.decompress(`./current/${file}`, `./compare/old`);
    });

    await extras.checkMods("./compare/old");

    await fs.readdirSync("./downloads").forEach(file => {
        archivizer.decompress(`./downloads/${file}`, `./compare/new`);
    });

    await extras.checkMods("./compare/new");


    let changeList = await comparator.compare("./compare/old", "./compare/new");

    await merger.merge(changeList);

    await archivizer.compressDirectory("./temp", "./out/test.zip");
}

begin();