/*
 * File: compressor.js
 * Project: Valhalla-Updater
 * File Created: Friday, 10th May 2024 9:43:10 pm
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 25th May 2024 4:05:47 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const AdmZip = require('adm-zip');
const ProgressBar = require('progress');
const fs = require('fs');
const path = require('path');
const { calculateTotalSize } = require('./functions');


module.exports = {

    /**
     * Decompresses a zip file to the specified path.
     * @param {string} zipFilePath Path to the zip file to decompress.
     * @param {string} extractToPath Path to the extracted files.
     * @returns
     */
    decompress: async function (zipFilePath, extractToPath) {
        return new Promise((resolve, reject) => {
            const zip = new AdmZip(zipFilePath);
            const zipEntries = zip.getEntries();

            // Calculate total size of entries for progress bar
            let totalSize = 0;
            zipEntries.forEach(entry => {
                totalSize += entry.header.size;
            });

            // Initialize progress bar
            const bar = new ProgressBar(`Extracting ${zipFilePath.split("/").at(-1)} [:bar] :rate/bps :percent :etas`, {
                complete: '=',
                incomplete: ' ',
                width: 40,
                total: totalSize
            });

            // Extract entries
            zipEntries.forEach(entry => {
                // Extract entry
                zip.extractEntryTo(entry, extractToPath, true, true);

                // Update progress bar
                bar.tick(entry.header.size);
            });

            resolve();
        });
    },

    /**
     * Compresses a list of files to a zip file.
     * @param {Array} filesToCompress Array with files to compress.
     * @param {string} outputPath Path to the output zip file.
     * @returns
     */
    compressFile: async function (filesToCompress, outputPath) {
        return new Promise((resolve, reject) => {
            const zip = new AdmZip();

            // Add files to zip
            filesToCompress.forEach(file => {
                zip.addLocalFile(file);
            });

            // Initialize progress bar
            const totalSize = zip.toBuffer().length;
            const bar = new ProgressBar(`Compressing ${filesToCompress.split("/").at(-1)} [:bar] :rate/bps :percent :etas`, {
                complete: '=',
                incomplete: ' ',
                width: 40,
                total: totalSize
            });

            // Write zip to output path
            zip.writeZip(outputPath, () => {
                // Update progress bar
                bar.tick(totalSize);
                resolve();
            });
        });
    },

    /**
     * Compresses content of the directory to a zip file.
     * @param {string} filesToCompress Path to a directory to compress.
     * @param {string} outputPath Path to the output zip file.
     * @returns
     */
    compressDirectory: function (directoryPath, outputPath) {
        const totalSize = calculateTotalSize(directoryPath);

        //console.log(totalSize);
        // Initialize progress bar
        const bar = new ProgressBar(`Compressing ${directoryPath.split("/").at(-1)} [:bar] :rate/bps :percent :etas`, {
            complete: '=',
            incomplete: ' ',
            width: 40,
            total: totalSize
        });

        // Compress files synchronously while updating progress bar
        const zip = new AdmZip();

        function addFilesToZip(dir, relativePath) {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    const subdirRelativePath = path.join(relativePath, file);
                    zip.addFile(subdirRelativePath + '/', Buffer.alloc(0)); // Add directory entry
                    addFilesToZip(filePath, subdirRelativePath); // Recursively add files in subdirectories
                } else {
                    const fileRelativePath = path.join(relativePath, file);
                    zip.addLocalFile(filePath, relativePath);
                    bar.tick(stats.size); // Update progress bar
                }
            });
        }

        addFilesToZip(directoryPath, '');

        // Write zip to output path
        zip.writeZip(outputPath);
    }
};
