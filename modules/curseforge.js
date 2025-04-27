/*
 * File: curseforge.js
 * Project: valhalla-updater
 * File Created: Saturday, 11th May 2024 7:27:27 pm
 * Author: flaasz
 * -----
 * Last Modified: Friday, 14th June 2024 10:52:31 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const axios = require('axios');
require('dotenv').config();


const curseforgeAPIKey = process.env.CURSEFORGE_APIKEY;
const header = {
    'x-api-key': curseforgeAPIKey
};

// BAD PRACTICE: Using a browser User-Agent for the www.curseforge.com endpoint
// This is a workaround for the fact that the CurseForge API does not provide a direct way to get additional files
const browserUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

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
     * @returns Id of the server pack file, if it exists. Otherwise, returns null.
     */
    getServerFileId: async function (modPackId, versionId) {
        try {
            let response = await axios.get(`https://api.curseforge.com/v1/mods/${modPackId}/files/${versionId}`, {
                headers: header
            });
            //console.log(response);
            if (!response.data.data.serverPackFileId) return null;
            return response.data.data.serverPackFileId;
        } catch (error) {
            // Log specific error for debugging, but return null for flow control
            console.error(`Error fetching server file ID for ${modPackId}/${versionId}:`, error.response ? error.response.status : error.message);
            return null;
        }
    },

    /**
     * Gets the fileId of the server pack file from additional files endpoint as a fallback.
     * Tries the www.curseforge.com endpoint with a browser User-Agent.
     * @param {number} modPackId Id of the modpack on CurseForge.
     * @param {number} versionId Version of the modpack file.
     * @returns Id of the server pack file if found, otherwise null.
     */
    getAdditionalServerFileId: async function (modPackId, versionId) {
        try {
            const response = await axios.get(`https://www.curseforge.com/api/v1/mods/${modPackId}/files/${versionId}/additional-files`, {
                headers: {
                    'User-Agent': browserUserAgent // Add browser User-Agent
                }
            });

            if (response.data && response.data.data && response.data.data.length > 0) {
                // Heuristic: Look for a file with "Server" in its name
                const serverPack = response.data.data.find(file =>
                    (file.displayName && file.displayName.toLowerCase().includes('server')) ||
                    (file.fileName && file.fileName.toLowerCase().includes('server'))
                );
                if (serverPack) {
                    console.log(`Found potential server pack via additional files (www) for ${modPackId}/${versionId}: ID ${serverPack.id}`);
                    return serverPack.id;
                }
            }
            return null; // No additional files or no file matching the heuristic
        } catch (error) {
            // Log error specifically for the www endpoint attempt
            console.error(`Error fetching additional server file ID for ${modPackId}/${versionId} using www URL + User-Agent:`, error.response ? error.response.status : error.message);
            return null;
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
     * Gets the latest pack version changelog.
     * @param {number} modPackId Id of the modpack on CurseForge.
     * @param {number} versionId Version of the changelog.
     * @returns String containing the changelog.
     */
    getChangelog: async function (modPackId, versionId) {
        try {
            let response = await axios.get(`https://api.curseforge.com/v1/mods/${modPackId}/files/${versionId}/changelog`, {
                headers: header
            });
            return response.data.data;
        } catch (error) {
            console.error(error);
        }
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