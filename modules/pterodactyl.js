const axios = require('axios');
const { compressFile } = require('./archivizer');
const { rename } = require('fs-extra');
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
    }

};