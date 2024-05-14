const axios = require('axios');
require('dotenv').config();


const curseforgeAPIKey = process.env.CURSEFORGE_APIKEY;
const header = {
    'x-api-key': curseforgeAPIKey
};

module.exports = {
    getPackData: async function (modPackId) {
        try {
            let response = await axios.get(`https://api.curseforge.com/v1/mods/${modPackId}`, {
                headers: header
            });
            //console.log(response);
            return response.data.data;
        } catch (error) {
            console.error(error);
        }
    },

    getServerFileLink: async function (modPackId, versionId) {
        try {
            let response = await axios.get(`https://api.curseforge.com/v1/mods/${modPackId}/files/${versionId}`, {
                headers: header
            });
            //console.log(response);
            return response.data.data.downloadUrl;
        } catch (error) {
            console.error(error);
        }
    },

    getServerFileId: async function (modPackId, versionId) {
        try {
            let response = await axios.get(`https://api.curseforge.com/v1/mods/${modPackId}/files/${versionId}`, {
                headers: header
            });
            //console.log(response);
            if (!response.data.data.serverPackFileId) return versionId;
            return response.data.data.serverPackFileId;
        } catch (error) {
            console.error(error);
        }
    },

    getLatestVersionId: async function (modPackId) {
        let data = await this.getPackData(modPackId);

        return data.mainFileId;
    },

    getLatestServerPackId: async function (modPackId) {
        let data = await this.getPackData(modPackId);

        if (data.latestFiles[0].serverPackFileId) return data.latestFiles[0].id;
        return data.latestFiles[0].serverPackFileId;
    },

    checkIfUpdate: async function (modPackId, currentVersion) {
        let data = await this.getLatestVersionId(modPackId);

        //console.log(data);
        if (data == currentVersion) {
            return false;
        }
        return true;
    }
};