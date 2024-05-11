const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const progress = require('progress');


// Promisify pipeline for better error handling

module.exports = {
    download: async function (fileUrl, destinationPath) {
        const fileName = path.basename(destinationPath);
        if (!fs.existsSync(path.dirname(destinationPath))){
            fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        }
        const writer = fs.createWriteStream(destinationPath);
        const {
            data,
            headers
        } = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        });

        const totalLength = parseInt(headers['content-length'], 10);
        const progressBar = new progress(`Downloading ${fileName} [:bar] :rate/bps :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 1,
            total: totalLength
        });

        data.on('data', (chunk) => {
            progressBar.tick(chunk.length);
        });

        data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log(`${fileName} downloaded successfully.`);
    },


    upload: async function (file, uploadUrl) {
        const fileName = path.basename(file);
        const fileSize = fs.statSync(file).size;
        const fileStream = fs.createReadStream(file);
    
        const progressBar = new progress(`Uploading ${fileName} [:bar] :rate/bps :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 1,
            total: fileSize
        });
    
        const config = {
            onUploadProgress: (progressEvent) => {
                progressBar.tick(progressEvent.loaded);
            }
        };
    
        const formData = new FormData();
        formData.append('files', fileStream, fileName);
    
        try {
            await axios.post(uploadUrl, formData, {
                ...config,
                headers: {
                    ...formData.getHeaders()
                }
            });
            console.log(`${fileName} uploaded successfully.`);
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    }
};