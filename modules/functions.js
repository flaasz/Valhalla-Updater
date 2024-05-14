const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');


module.exports = {
    checkMods: async function (path) {
        let folderContents = await fs.readdirSync(path);
        if (!folderContents.includes("mods")) {
          console.log("Mods folder not found! Removing parent folder...");
          await this.removeParentFolder(`${path}/${folderContents[0]}`);
        }
    },

    sleep: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    hashFile: function (filePath) {
        const file = fs.readFileSync(filePath);
        let hash = crypto.createHash('sha1').update(file).digest('hex');
        return hash;
    },

    removeParentFolder: async function (folderPath) {
        try {
            const parentDir = await fs.readdir(folderPath);
            // Move all files and folders to the relative parent directory
            for (const file of parentDir) {
                const fullPath = path.join(folderPath, file);
                const destPath = path.join(path.dirname(folderPath), file);
                await fs.move(fullPath, destPath, { overwrite: true });
            }
            // Remove the now empty parent folder
            await fs.rmdir(folderPath);
            console.log(`Parent folder '${folderPath}' removed successfully.`);
        } catch (err) {
            console.error(`Error removing parent folder '${folderPath}':`, err);
        }
    },

    clearConsole: function (amount) {
        process.stdout.moveCursor(0, -amount);
        process.stdout.clearScreenDown();
    },
};

