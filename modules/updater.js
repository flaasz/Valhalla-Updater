const fs = require('fs');
const archivizer = require('./archivizer');
const comparator = require('./comparator');
const merger = require('./merger');
const extras = require('./extras');


module.exports = {
    update: async function () {

        /*await fs.rmSync("./compare", { //cleanup first 
            recursive: true,
            force: true
        });
    
        await fs.readdirSync("./current").forEach(file => {
            archivizer.decompress(`./current/${file}`, `./compare/old`);
        });
    
        await extras.checkMods("./compare/old");
    
        await fs.readdirSync("./downloads").forEach(file => {
            archivizer.decompress(`./downloads/${file}`, `./compare/new`);
        });*/

        //await extras.checkMods("./compare/new");


        let customChanges = await comparator.findCustomChanges("./temp", "./compare/old");
        //let changeList = await comparator.compare("./compare/old", "./compare/new");

        console.log(customChanges);
        //await merger.merge(changeList);

        //await archivizer.compressDirectory("./temp", "./out/test.zip");
    }
};