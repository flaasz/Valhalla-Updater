/*
 * File: unpacker.js
 * Project: Valhalla-Updater
 * File Created: Sunday, 12th May 2024 1:50:29 am
 * Author: flaasz
 * -----
 * Last Modified: Tuesday, 28th May 2024 11:25:05 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const unpacker = require("unpacker-with-progress");
const progress = require('progress');
const path = require('path');
const fs = require('fs');
const tar = require('tar');
const zlib = require('zlib');

module.exports = {

    /**
     * Unpacks a tar.gz file into the specified destination path.
     * @param {string} zip Path to a tar.gz file.
     * @param {string} destinationPath Path to the destination folder.
     * @returns 
     */
    unpack: async function (zip, destinationPath) {
        const fileSize = fs.statSync(zip).size;
        const progressBar = new progress(`Unpacking ${path.basename(zip)} [:bar] :rate/bps :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 100,
            total: fileSize
        });
        return Promise.all([
            unpacker(zip, destinationPath, {
                onprogress(progress) {
                    progressBar.update(progress.percent);
                }
            })
        ]);
    },

    getStructure: async function (tarGzFilePath) {
        const baseFileStructure = [];

        return new Promise((resolve, reject) => {
            fs.createReadStream(tarGzFilePath)
                .pipe(zlib.createGunzip())
                .pipe(tar.t())
                .on('entry', entry => {
                    if (entry.path.split('/').length === 1) {
                        baseFileStructure.push(entry.path);
                    }
                    entry.resume(); // Ensure stream continues
                })
                .on('end', () => resolve(baseFileStructure))
                .on('error', err => reject(err));
        });
    }
};