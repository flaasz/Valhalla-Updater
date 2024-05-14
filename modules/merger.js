var fs = require('fs');


module.exports = {
    merge: function (changeList) {
        for (let path of changeList.deletions) {
            if (fs.existsSync(`./temp${path}`)) {
                fs.rmSync(`./temp${path}`, { recursive: true, force: true });
            }
        }
        console.log("Removed old files");
        for (let path of changeList.additions) {
            fs.cpSync(`./compare/new${path}`, `./temp${path}`, {recursive: true});
            //fs.copyFileSync(`./compare/new${path}`, `./temp${path}`);
        }
        console.log("Added new files");
    },

    mergeFromManifest: function (dir, changeList, customChanges) {


        //this doesnt work yet!!!!!
        let customOverwrites = [];

        for (let path of changeList.left) {
            if (fs.existsSync(`${dir}${path}`)) {
                fs.rmSync(`${dir}${path}`, { recursive: true, force: true });
            }
        }
        console.log("Removed old files");
        for (let path of changeList.right) {
            fs.cpSync(`${dir}${path}`, `${dir}${path}`, {recursive: true});
        }
        console.log("Added new files");
    }
};