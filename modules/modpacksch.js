/*
 * File: modpacksch.js
 * Project: Valhalla-Updater
 * File Created: Wednesday, 15th May 2024 10:36:56 pm
 * Author: flaasz
 * -----
 * Last Modified: Monday, 27th May 2024 9:07:46 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const axios = require('axios');

module.exports = {

    /**
     * Gets the latest version of a modpack from Feed The Beast.
     * @param {number} modPackId Modpack Id from Feed The Beast.
     * @returns Id of the latest version of the modpack.
     */
    getLatestFTBVersionId: async function (modPackId) {
        let response = await axios.get(`https://api.modpacks.ch/public/modpack/${modPackId}`);

        return response.data.versions[response.data.versions.length - 1].id;
    },

    /**
     * Gets a manifest of the version of the modpack from Feed The Beast. (modpacks.ch)
     * @param {number} modPackId Modpack Id from Feed The Beast.
     * @param {number} modPackVersion Version of the modpack.
     * @returns Object containing the manifest of the modpack.
     */
    getFTBPackManifest: async function (modPackId, modPackVersion) {
        let response = await axios.get(`https://api.modpacks.ch/public/modpack/${modPackId}/${modPackVersion}`);

        return response.data;
    },

    /**
     * Gett the data of the modpack from Feed The Beast. (modpacks.ch)
     * @param {number} modPackId Modpack Id from Feed The Beast.
     * @returns Object containing the data of the modpack.
     */
    getFTBPackData: async function (modPackId) {
        let response = await axios.get(`https://api.modpacks.ch/public/modpack/${modPackId}`);

        return response.data;
    },

    /**
     * Gets a manifest of the version of the modpack from CurseForge. (modpacks.ch)
     * @param {number} modPackId Modpack Id from CurseForge.
     * @param {number} modPackVersion Version of the modpack.
     * @returns Object containing the manifest of the modpack.
     */
    getCFPackManifest: async function (modPackId, modPackVersion) {
        let response = await axios.get(`https://api.modpacks.ch/public/curseforge/${modPackId}/${modPackVersion}`);

        return response.data;
    },

    /**
     * Gets the data of the modpack from CurseForge. (modpacks.ch)
     * @param {number} modPackId Modpack Id from CurseForge.
     * @returns Object containing the data of the modpack.
     */
    getCFPackData: async function (modPackId) {
        let response = await axios.get(`https://api.modpacks.ch/public/curseforge/${modPackId}`);

        return response.data;
    }

};