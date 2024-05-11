const AdmZip = require('adm-zip');
const ProgressBar = require('progress');
const fs = require('fs');
const path = require('path');


const zipDirectory = async (sourceDir, outputFilePath) => {
    const zip = new AdmZip();
    zip.addLocalFolder(sourceDir);
    await zip.writeZipPromise(outputFilePath);
    console.log(`Zip file created: ${outputFilePath}`);
};

const unzipDirectory = async (inputFilePath, outputDirectory) => {
    const zip = new AdmZip(inputFilePath);
    return new Promise((resolve, reject) => {
        zip.extractAllToAsync(outputDirectory, true, (error) => {
            if (error) {
                console.log(error);
                reject(error);
            } else {
                console.log(`Extracted to "${outputDirectory}" successfully`);
                resolve();
            }
        });
    });
};


//unzipDirectory('./dir1/Craft to Exile 2 SERVER-0.5.2.zip', `./temp`);


module.exports = {

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
                width: 20,
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
                width: 20,
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

    compressDirectory: function (directoryPath, outputPath) {
        const totalSize = calculateTotalSize(directoryPath);

        console.log(totalSize);
        // Initialize progress bar
        const bar = new ProgressBar(`Compressing ${directoryPath.split("/").at(-1)} [:bar] :rate/bps :percent :etas`, {
            complete: '=',
            incomplete: ' ',
            width: 20,
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

function calculateTotalSize(dir) {
    let totalSize = 0;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            totalSize += calculateTotalSize(filePath); // Recursively calculate size of files in subdirectories
        } else {
            totalSize += stats.size;
        }
    });
    return totalSize;
}