const copydir = require('copy-dir');
const fs = require('fs-extra');
const path = require('path');



module.exports = {
    copyDir: async function (a, b, options = {}) {
        copydir(a, b, options);
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
    }
};