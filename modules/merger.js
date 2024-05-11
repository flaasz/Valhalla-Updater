var fs = require('fs');


module.exports = {
    merge: async function (changeList) {
        for (let path of changeList.deletions) {
            if (fs.existsSync(`./temp${path}`)) {
                fs.unlinkSync(`./temp${path}`);
            }
        }
        console.log("Removed old files");
        for (let path of changeList.additions) {
            fs.copyFileSync(`./compare/new${path}`, `./temp${path}`);
        }
        console.log("Added new files");
    }
};