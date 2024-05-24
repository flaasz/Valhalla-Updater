const axios = require('axios');
require('dotenv').config();


const curseforgeAPIKey = process.env.CURSEFORGE_APIKEY;
const header = {
    'x-api-key': curseforgeAPIKey
};

module.exports = {
    /**
     * Gets the data of a modpack.
     * @param {number} modPackId Id of the modpack on CurseForge.
     * @returns Object containing the data of the modpack.
     */
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

    /**
     * Gets the download link of a modpack file.
     * @param {number} modPackId Id of the modpack on CurseForge.
     * @param {number} versionId Version of the modpack file.
     * @returns Url to download the modpack file.
     */
    getFileLink: async function (modPackId, versionId) {
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

    /**
     * Gets the fileId of the server pack file.
     * @param {number} modPackId Id of the modpack on CurseForge.
     * @param {number} versionId Version of the modpack file.
     * @returns Id of the server pack file, if it exists. Otherwise, returns the versionId.
     */
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

    /**
     * Gets the latest pack version.
     * @param {number} modPackId Id of the modpack on CurseForge.
     * @returns Id of the latest version of the modpack.
     */
    getLatestVersionId: async function (modPackId) {
        let data = await this.getPackData(modPackId);

        return data.mainFileId;
    },

    /**
     * Checks if the modpack has an update.
     * @param {number} modPackId Id of the modpack on CurseForge.
     * @param {number} currentVersion Current version of the modpack.
     * @returns True if the modpack has an update, false otherwise.
     */
    checkIfUpdate: async function (modPackId, currentVersion) {
        let data = await this.getLatestVersionId(modPackId);

        //console.log(data);
        if (data == currentVersion) {
            return false;
        }
        return true;
    }
};