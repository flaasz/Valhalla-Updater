const {
    MongoClient
} = require('mongodb');
require('dotenv').config();
const { mongoDBName, mongoDBserversCollection } = require("../config/config.json");

const mongoClient = new MongoClient(process.env.MONGODB_URL);

const db = mongoClient.db(mongoDBName);

module.exports = {

    /**
     * Gets all current servers data from MongoDB.
     * @returns Array of objects containing the server data.
     */
    getServers: async function () {
        await mongoClient.connect();
        const serversCollection = db.collection(mongoDBserversCollection);
        const serversArray = await serversCollection.find({}).toArray();

        //console.log(serversArray);
        mongoClient.close();
        return serversArray;
    },

    /**
     * Update the data of a server in MongoDB.
     * @param {number} modpackId ID of the modpack on CF/FTB.
     * @param {object} update Object containing the fields to update.
     */
    updateServer: async function (modpackId, update) {
        await mongoClient.connect();
        const serversCollection = db.collection(mongoDBserversCollection);

        await serversCollection.updateMany({
            modpackID: modpackId
        }, update);

        mongoClient.close();
    },
};