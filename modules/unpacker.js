const unpacker = require("unpacker-with-progress");
const progress = require('progress');
const path = require('path');
const fs = require('fs');

module.exports = {

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
    }
};