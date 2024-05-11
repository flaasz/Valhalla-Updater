const fs = require('fs');
const copy = require('./copy');

module.exports = {
    checkMods: async function (path) {
        let folderContents = await fs.readdirSync(path);
        if (!folderContents.includes("mods")) {
          console.log("Mods folder not found! Removing parent folder...");
          await copy.removeParentFolder(`${path}/${folderContents[0]}`);
        }
    },

    sleep: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};