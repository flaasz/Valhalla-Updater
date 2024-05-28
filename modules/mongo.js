/*
 * File: mongo.js
 * Project: Valhalla-Updater
 * File Created: Wednesday, 15th May 2024 9:00:51 pm
 * Author: flaasz
 * -----
 * Last Modified: Monday, 27th May 2024 11:54:21 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const {
    MongoClient
} = require('mongodb');
require('dotenv').config();
const {
    mongoDBName,
    mongoDBserversCollection
} = require("../config/config.json").mongodb;

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
     * Update the data of multiple servers in MongoDB.
     * @param {number} modpackId ID of the modpack on CF/FTB.
     * @param {object} update Object containing the fields to update.
     */
    updateServers: async function (modpackId, update) {
        await mongoClient.connect();
        const serversCollection = db.collection(mongoDBserversCollection);

        await serversCollection.updateMany({
            modpackID: modpackId
        }, update);

        mongoClient.close();
    },

    /**
     * Update the data of a single server in MongoDB.
     * @param {number} serverId ID of the server on the panel.
     * @param {object} update Object containing the fields to update.
     */
    updateServer: async function (serverId, update) {
        await mongoClient.connect();
        const serversCollection = db.collection(mongoDBserversCollection);

        await serversCollection.updateOne({
            serverId: serverId
        }, update);

        mongoClient.close();
    },
};