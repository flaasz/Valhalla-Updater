/*
 * File: manifest.js
 * Project: Valhalla-Updater
 * File Created: Sunday, 12th May 2024 7:23:33 pm
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 25th May 2024 4:00:09 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const fs = require('fs');
const path = require('path');
const {
    hashFile,
    countFiles
} = require('./functions');
const progress = require('progress');


module.exports = {
    /**
     * Generates a manifest of all files in the specified directory and its subdirectories.
     * @param {string} directory Path to the directory to generate the manifest for.
     * @returns Array of objects containing the name, path, size, and SHA1 hash of each file.
     */
    generate: function (directory) {

        var manifest = [];

        const progressBar = new progress(`Generating manifest [:bar] :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 100,
            total: countFiles(directory)
        });

        createEntry(directory, directory, progressBar, manifest);

        return manifest;
    }
};

/**
 * Recursively generates a manifest of all files in the specified directory and its subdirectories.
 * @param {string} directory Path to the directory to generate the manifest for.
 * @param {string} basePath Base path of the directory.
 * @param {*} progressBar Progress bar to update.
 * @param {Array} manifest Array to store the manifest entries.
 */
function createEntry(directory, basePath, progressBar, manifest) {
    const files = fs.readdirSync(directory);

    files.forEach(file => {

        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            const subManifest = createEntry(filePath, basePath, progressBar, manifest);
            manifest.push.apply(manifest, subManifest);
        } else {
            let entry = {
                name: file,
                path: path.relative(basePath, directory).replace(/\\/g, '/'),
                size: stats.size,
                sha1: hashFile(filePath)
            };

            manifest.push(entry);
            progressBar.tick(1);
        }
    });
}

