/*
 * File: functions.js
 * Project: valhalla-updater
 * File Created: Saturday, 11th May 2024 4:13:53 pm
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 1st June 2024 11:10:19 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');


module.exports = {

    /**
     * Checks if the mods folder exists in the specified path and removes the parent folder if it doesn't.
     * @param {string} path Path to the folder to check.
     */
    checkMods: async function (path) {
        let folderContents = await fs.readdirSync(path);
        if (!folderContents.includes("mods")) {
            console.log("Mods folder not found! Removing parent folder...");
            await module.exports.removeParentFolder(`${path}/${folderContents[0]}`);
        }
    },

    /**
     * Recursively deletes the specified directory if it exists.
     * @param {*} dirPath Path to the directory to delete.
     */
    rmRecursive: function (dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, {
                recursive: true,
                force: true
            });
        }
    },

    /**
     * Sleeps for the specified amount of time.
     * @param {number} ms Time in milliseconds.
     * @returns Promise that resolves after the specified time.
     */
    sleep: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Hashes a file using the SHA1 algorithm.
     * @param {string} filePath Path to the file to hash.
     * @returns Hash of the file as a string.
     */
    hashFile: function (filePath) {
        const file = fs.readFileSync(filePath);
        let hash = crypto.createHash('sha1').update(file).digest('hex');
        return hash;
    },

    /**
     * Moves all files out of a folder and removes the folder.
     * @param {string} folderPath Path to the folder to remove.
     */
    removeParentFolder: async function (folderPath) {
        try {
            const parentDir = await fs.readdir(folderPath);
            // Move all files and folders to the relative parent directory
            for (const file of parentDir) {
                const fullPath = path.join(folderPath, file);
                const destPath = path.join(path.dirname(folderPath), file);
                await fs.move(fullPath, destPath, {
                    overwrite: true
                });
            }
            // Remove the now empty parent folder
            await fs.rmdir(folderPath);
            console.log(`Parent folder '${folderPath}' removed successfully.`);
        } catch (err) {
            console.error(`Error removing parent folder '${folderPath}':`, err);
        }
    },

    /**
     * Clears console output by moving the cursor up by the specified amount and clearing the screen down.
     * @param {number} amount Number of lines to move the cursor up by.
     */
    clearConsole: function (amount) {
        process.stdout.moveCursor(0, -amount);
        process.stdout.clearScreenDown();
    },

    /**
     * Gets the version number from a string.
     * @param {string} versionString The string to extract the version number from.
     * @returns The version number as a string.
     */
    getVersion: function (versionString) {

        const versionRegex = /(\bv\d+[a-zA-Z]*\b|v\d+[a-zA-Z]*|\d+\.\d+\.\d+([a-zA-Z_]\w*)?|\d+\.\d+([a-zA-Z_]\w*)?)($|\s|\.zip|)/g;

        let version = versionString.match(versionRegex);
        return version ? version[0].trim().replace(/\.zip$|v/g, '') : null;
    },

    /**
     * Calculates the size of all files in the specified directory.
     * @param {string} dir A directory to calculate the size of.
     * @returns Size of all files in the directory in bytes.
     */
    calculateTotalSize: function (dir) {
        let totalSize = 0;
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                totalSize += module.exports.calculateTotalSize(filePath);
            } else {
                totalSize += stats.size;
            }
        });
        return totalSize;
    },

    /**
     * Counts the number of files in a directory and its subdirectories.
     * @param {string} dir Path to the directory to count files in.
     * @returns Number of files in the directory.
     */
    countFiles: function (dir) {
        let count = 0;

        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                count++;
            } else if (stats.isDirectory()) {
                count += module.exports.countFiles(filePath);
            }
        });

        return count;
    }
};
