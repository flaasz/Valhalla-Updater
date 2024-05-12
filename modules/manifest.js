const fs = require('fs');
const path = require('path');
const {
    hashFile
} = require('./hasher');
const progress = require('progress');


module.exports = {
    generate: function (directory) {

        var manifest = [];

        const progressBar = new progress(`Generating manifest [:bar] :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 1,
            total: countFiles(directory)
        });

        createEntry(directory,directory, progressBar, manifest);

        return manifest;
    }
};

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

function countFiles(dir) {
    let count = 0;

    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
            count++;
        } else if (stats.isDirectory()) {
            count += countFiles(filePath);
        }
    });

    return count;
}