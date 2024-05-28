/*
 * File: compressor.js
 * Project: Valhalla-Updater
 * File Created: Friday, 10th May 2024 9:43:10 pm
 * Author: flaasz
 * -----
 * Last Modified: Tuesday, 28th May 2024 11:12:19 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const AdmZip = require('adm-zip');
const archiver = require('archiver');
const ProgressBar = require('progress');
const fs = require('fs');
const path = require('path');
const {
    calculateTotalSize
} = require('./functions');


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
     * @param {string} directoryPath Path to a directory to compress.
     * @param {string} outputPath Path to the output zip file.
     * @returns
     */
    compressDirectoryAAA: function (directoryPath, outputPath) {
        return new Promise((resolve, reject) => {
            const totalSize = calculateTotalSize(directoryPath);

            // Initialize progress bar
            const bar = new ProgressBar(`Compressing ${directoryPath.split("/").at(-1)} [:bar] :rate/bps :percent :etas`, {
                complete: '=',
                incomplete: ' ',
                width: 40,
                total: totalSize
            });

            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', {
                zlib: {
                    level: 9
                } // Sets the compression level.
            });

            output.on('close', function () {
                console.log(archive.pointer() + ' total bytes');
                console.log('archiver has been finalized and the output file descriptor has closed.');
                resolve(); // Resolve the promise here
            });

            archive.on('error', function (err) {
                reject(err); // Reject the promise if there's an error
            });

            archive.on('progress', function (progress) {
                bar.tick(progress.fs.processedBytes - bar.curr);
            });

            archive.pipe(output);

            // Add files and directories with permissions
            function addFilesToArchive(dir, relativePath) {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    const fileRelativePath = path.join(relativePath, file);
                    if (stats.isDirectory()) {
                        archive.directory(filePath, fileRelativePath, {
                            mode: stats.mode
                        });
                        addFilesToArchive(filePath, fileRelativePath);
                    } else {
                        archive.file(filePath, {
                            name: fileRelativePath,
                            mode: stats.mode
                        });
                        bar.tick(stats.size); // Update progress bar
                    }
                });
            }

            addFilesToArchive(directoryPath, '');

            // Finalize the archive
            archive.finalize();
        });
    },

    compressDirectory: function (sourceDir, outPath) {
        console.log(`Compressing ${sourceDir} to ${outPath}...`);
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outPath);
            const archive = archiver('zip', {
                zlib: {
                    level: 9
                }
            });

            output.on('close', function () {
                console.log(`${outPath} compression complete.`);
                resolve();
            });

            archive.on('error', function (err) {
                reject(err);
            });

            archive.pipe(output);

            archive.directory(sourceDir, false);

            archive.finalize();
        });
    }
};