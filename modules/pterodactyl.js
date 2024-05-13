const axios = require('axios');
const progress = require('progress');
require('dotenv').config();


const pterodactylAPIKey = process.env.PTERODACTYL_APIKEY;
const pterodactylHostName = process.env.PTERODACTYL_HOSTNAME;
const header = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": `Bearer ${pterodactylAPIKey}`,
};


module.exports = {
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

    compressFile: async function (serverID, fileList) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/files/compress`, {
                root: "/",
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

    deleteFile: async function (serverID, fileList) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/files/delete`, {
                root: "/",
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

    renameFile: async function (serverID, path, newName) {
        try {
            let response = await axios.put(`${pterodactylHostName}api/client/servers/${serverID}/files/rename`, {
                root: "/",
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

    shutdown: async function (serverID) {

        let timeToKill = 30; // seconds
        let interval = 2; // seconds per api call

        const progressBar = new progress(`Shutting down the server [:bar] :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 100,
            total: timeToKill * interval
        });

        let iterator = 0;
        this.sendPowerAction(serverID, "stop");
        let shutdownSequence = setInterval(async () => {
            let status = await this.getStatus(serverID);
            //console.log(status);
            if (status.attributes.current_state === "offline") {
                progressBar.update(1);
                clearInterval(shutdownSequence);
            } else {
                progressBar.tick(1);
                iterator+=interval;
            }
            if (iterator >= timeToKill * interval) {
                this.sendPowerAction(serverID, "kill");
                progressBar.update(1);
                console.log("This took longer than expected. Killing the server...");
                clearInterval(shutdownSequence);
            }
        }, interval * 1000);

    }

};