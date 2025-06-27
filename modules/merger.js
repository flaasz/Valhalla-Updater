/*
 * File: merger.js
 * Project: Valhalla-Updater
 * File Created: Friday, 10th May 2024 10:43:43 pm
 * Author: flaasz
 * -----
 * Last Modified: Tuesday, 28th May 2024 7:25:50 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

var fs = require('fs');
const {
    downloadList
} = require('./downloader');

module.exports = {
    /**
     * Merges the changes from the changeList to the temp directory.
     * @param {String} dir Work directory to merge changes to.
     * @param {Object} changeList ChangeList object containing the changes.
     */
    merge: function (dir, changeList) {
        for (let path of changeList.deletions) {
            if (fs.existsSync(`${dir}/compare/main${path}`)) {
                fs.rmSync(`${dir}/compare/main${path}`, {
                    recursive: true,
                    force: true
                });
            }
        }        console.log("Removed old files");
        for (let path of changeList.additions) {
            try {
                const sourcePath = `${dir}/compare/new${path}`;
                const destPath = `${dir}/compare/main${path}`;
                
                // Check if source path exists before copying
                if (fs.existsSync(sourcePath)) {
                    // Create parent directory if it doesn't exist
                    const parentDir = destPath.substring(0, destPath.lastIndexOf('/'));
                    if (!fs.existsSync(parentDir)) {
                        fs.mkdirSync(parentDir, { recursive: true });
                    }
                    
                    fs.cpSync(sourcePath, destPath, {
                        recursive: true
                    });
                } else {
                    console.log(`Warning: Source path does not exist: ${sourcePath}`);
                }
            } catch (error) {
                console.error(`Error copying file ${path}: ${error.message}`);
                // Continue with next file instead of failing the entire update
            }
        }
        console.log("Added new files");
    },

    /**
     * Merges the changes from the changeList to the temp directory.
     * @param {string} dir The directory to merge the changes to.
     * @param {object} changeList Object containing the changes.
     * @param {object} newManifest Object containing the new manifest.
     */
    mergeFromManifest: async function (dir, changeList, newManifest) {
        for (let path of changeList.deletions) {
            if (fs.existsSync(`${dir}${path}`)) {
                await fs.rmSync(`${dir}${path}`, {
                    recursive: true,
                    force: true
                });
            }
        }
        console.log("Removed old files");
        let toDownload = newManifest.files.filter(obj => {
            const fullPath = `${obj.path}${obj.name}`;
            return changeList.additions.includes(fullPath);
        });
        await downloadList(toDownload, dir);
        console.log("Added new files");
    }
};