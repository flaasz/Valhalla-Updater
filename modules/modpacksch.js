const axios = require('axios');
const { getLatestVersionId } = require('./curseforge');



module.exports = {

    /**
     * Gets the latest version of a modpack from Feed The Beast.
     * @param {number} modPackId Modpack Id from Feed The Beast.
     * @returns Id of the latest version of the modpack.
     */
    getLatestFTBVersionId: async function (modPackId) {
        let response = await axios.get(`https://api.modpacks.ch/public/modpack/${modPackId}`);

        return response.data.versions[response.data.versions.length - 1].id;
    }

};