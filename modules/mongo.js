/*
 * File: mongo.js
 * Project: valhalla-updater
 * File Created: Wednesday, 15th May 2024 9:00:51 pm
 * Author: flaasz
 * -----
 * Last Modified: Thursday, 13th June 2024 4:14:10 pm
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
    mongoDBserversCollection,
    mongoDBshardsCollection
} = require("../config/config.json").mongodb;

const mongoClient = new MongoClient(process.env.MONGODB_URL);

module.exports = {

    /**
     * Gets all current servers data from MongoDB.
     * @returns Array of objects containing the server data.
     */
    getServers: async function () {
        await mongoClient.connect();
        const serversArray = await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .find({}).toArray();

        //console.log(serversArray);
        mongoClient.close();
        return serversArray;
    },

    /**
     * Gets all current shards data from MongoDB.
     * @returns Array of objects containing the shard data.
     */
        getShards: async function () {
            await mongoClient.connect();
            const shardsArray = await mongoClient
                .db(mongoDBName)
                .collection(mongoDBshardsCollection)
                .find({}).toArray();
    
            //console.log(shardsArray);
            mongoClient.close();
            return shardsArray;
        },


    /**
     * Update the data of multiple servers in MongoDB.
     * @param {number} modpackId ID of the modpack on CF/FTB.
     * @param {object} update Object containing the fields to update.
     */
    updateServers: async function (modpackId, update) {
        await mongoClient.connect();
        await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .updateMany({
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
        await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .updateOne({
                serverId: serverId
            }, update);

        mongoClient.close();
    },
};