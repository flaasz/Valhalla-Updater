const axios = require('axios');
const progress = require('progress');
require('dotenv').config();


const pterodactylAPIKey = process.env.PTERODACTYL_APIKEY;
const {
    pterodactylHostName
} = require("../config/config.json");

const header = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": `Bearer ${pterodactylAPIKey}`,
};


module.exports = {
    /**
     * Gets the status of a server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @returns Object containing the status of the server.
     */
    getStatus: async function (serverID) {
        try {
            let response = await axios.get(`${pterodactylHostName}api/client/servers/${serverID}/resources`, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Gets the one-time download link of a file.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} path Path to the file to download on Pterodactyl.
     * @returns URL to download the file.
     */
    getDownloadLink: async function (serverID, path) {
        path = path.replace("+", "%2B");
        //console.log(`${pterodactylHostName}api/client/servers/${serverID}/files/download?file=/${path}`);
        try {
            let response = await axios.get(`${pterodactylHostName}api/client/servers/${serverID}/files/download?file=${path}`, {
                headers: header
            });
            //console.log(response);
            return response.data.attributes.url;
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Gets the one-time upload link of a file.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @returns URL of the upload link.
     */
    getUploadLink: async function (serverID) {
        try {
            let response = await axios.get(`${pterodactylHostName}api/client/servers/${serverID}/files/upload`, {
                headers: header
            });
            //console.log(response);
            return response.data.attributes.url;
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Sends a power action to be executed on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} action Action to be executed on the server. Options: "start", "stop", "restart", "kill".
     * @returns 
     */
    sendPowerAction: async function (serverID, action) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/power`, {
                signal: action
            }, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Sends a request to compress a list of files on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {Array} fileList List of files to compress.
     * @param {string} listPath Path to the folder containing the files to compress. Defaults to the root directory.
     * @returns 
     */
    compressFile: async function (serverID, fileList, listPath = "/", ) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/files/compress`, {
                root: listPath,
                files: fileList,
            }, {
                headers: header
            });
            //console.log(response);
            return response.data.attributes.name;
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Sends a request to decompress a file on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} fileName Name of the file to decompress.
     * @param {string} filePath Path to the folder containing the file to decompress. Defaults to the root directory.
     * @returns 
     */
    decompressFile: async function (serverID, fileName, filePath = "/") {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/files/decompress`, {
                root: filePath,
                file: fileName,
            }, {
                headers: header
            });
            //console.log(response);
            return response.data.attributes.name;
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Sends a request to delete a list of files on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {Array} fileList List of files to delete.
     * @param {string} listPath Path to the folder containing the files to delete. Defaults to the root directory.
     * @returns 
     */
    deleteFile: async function (serverID, fileList, filePath = "/") {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/files/delete`, {
                root: filePath,
                files: fileList,
            }, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Sends a request to rename the specified file on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} path Path to the file to rename on the server.
     * @param {string} newName New name of the file.
     * @param {string} filePath Path to the file to rename. Defaults to the root directory.
     * @returns 
     */
    renameFile: async function (serverID, path, newName, filePath = "/") {
        try {
            let response = await axios.put(`${pterodactylHostName}api/client/servers/${serverID}/files/rename`, {
                root: filePath,
                files: path,
                name: newName
            }, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Executes a command on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} command Command to be executed on the server.
     */
    sendCommand: async function (serverID, command) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/command`, {
                command: command,
            }, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.log(error.response.status);
        }
    },

    /**
     * Begins a shutdown sequence on the server. If the server takes longer than the specified time to shut down, it will wait for it to idle and forcibly kill it.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {number} timeToKill Time in seconds to wait before killing the server. Default is 30 seconds.
     * @param {number} interval Interval in seconds to check the server status. Default interval is 3 seconds.
     */
    shutdown: async function (serverID, timeToKill = 30, interval = 3) {

        const progressBar = new progress(`Shutting down the server [:bar] :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 100,
            total: timeToKill + 1
        });

        let iterator = 0;
        await this.sendPowerAction(serverID, "stop");
        let shutdownSequence = setInterval(async () => {
            let status = await this.getStatus(serverID);
            //console.log(status);
            if (status.attributes.current_state === "offline") {
                progressBar.update(1);
                clearInterval(shutdownSequence);
            } else if (iterator < timeToKill) {
                progressBar.tick(interval);
                iterator += interval;
            }
            if (iterator >= timeToKill) {
                progressBar.update(0.99);
                console.log("\nThis is taking longer than expected...");
                process.stdout.moveCursor(76, -2);

                if (status.attributes.resources.cpu_absolute < 10) {
                    progressBar.update(1);
                    console.log("\nServer is idling. Killing it...");
                    await this.sendPowerAction(serverID, "kill");
                    clearInterval(shutdownSequence);
                }

            }
        }, interval * 1000);
    }

};