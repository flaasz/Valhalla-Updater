/*
 * File: mongo.js
 * Project: valhalla-updater
 * File Created: Wednesday, 15th May 2024 9:00:51 pm
 * Author: flaasz
 * -----
 * Last Modified: Thursday, 25th July 2024 5:49:53 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const {
    MongoClient,
    Long
} = require('mongodb');
require('dotenv').config();
const {
    mongoDBName,
    mongoDBserversCollection,
    mongoDBshardsCollection
} = require("../config/config.json").mongodb;

const mongoClient = new MongoClient(process.env.MONGODB_URL);

// Separate client for live embed operations to avoid race conditions
const liveEmbedClient = new MongoClient(process.env.MONGODB_URL);

// Keep track of connection state
let liveEmbedConnected = false;
let mainClientConnected = false;

module.exports = {

    /**
     * Gets all current servers data from MongoDB.
     * @returns Array of objects containing the server data.
     */
    getServers: async function () {
        if (!mainClientConnected) {
            await mongoClient.connect();
            mainClientConnected = true;
        }
        
        const serversArray = await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .find({}).toArray();

        //console.log(serversArray);
        return serversArray;
    },

    /**
     * Gets all current shards data from MongoDB.
     * @returns Array of objects containing the shard data.
     */
    getShards: async function () {
        if (!mainClientConnected) {
            await mongoClient.connect();
            mainClientConnected = true;
        }
        
        const shardsArray = await mongoClient
            .db(mongoDBName)
            .collection(mongoDBshardsCollection)
            .find({}).toArray();

        //console.log(shardsArray);
        return shardsArray;
    },


    /**
     * Gets all tickets user closed or participated in by user from MongoDB.
     * @param {*} id Id of the user.
     * @param {*} username Username of the user.
     * @returns Array of objects containing the tickets data.
     */
    getTickets: async function (id, username) {
        if (!mainClientConnected) {
            await mongoClient.connect();
            mainClientConnected = true;
        }
        
        const ticketsData = await mongoClient
            .db(mongoDBName)
            .collection('tickets');
        let array = await ticketsData.find({
            $or: [{
                closed_by: parseInt(id)
            }, {
                closed_by: new Long(id)
            }, {
                closed_by_name: username
            }]
        }).toArray();
        let contr = await ticketsData.find({
            [`users_involved.${id}`]: {
                $exists: true
            }
        }).toArray();
        //console.log(array);

        let results = [];
        results[0] = array;
        results[1] = contr;
        return results;
    },

    /**
     * Update the data of multiple servers in MongoDB.
     * @param {number} modpackId ID of the modpack on CF/FTB.
     * @param {object} update Object containing the fields to update.
     */
    updateServers: async function (modpackId, update) {
        if (!mainClientConnected) {
            await mongoClient.connect();
            mainClientConnected = true;
        }
        
        await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .updateMany({
                modpackID: modpackId
            }, update);
    },

    /**
     * Update the data of a single server in MongoDB.
     * @param {number} serverId ID of the server on the panel.
     * @param {object} update Object containing the fields to update.
     */
    updateServer: async function (serverId, update) {
        if (!mainClientConnected) {
            await mongoClient.connect();
            mainClientConnected = true;
        }
        
        await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .updateOne({
                serverId: serverId
            }, update);
    },

    /**
     * Gets all live embeds from MongoDB.
     * @returns Array of objects containing live embed data.
     */
    getLiveEmbeds: async function () {
        if (!liveEmbedConnected) {
            await liveEmbedClient.connect();
            liveEmbedConnected = true;
        }
        
        const embedsArray = await liveEmbedClient
            .db(mongoDBName)
            .collection('live_embeds')
            .find({}).toArray();

        return embedsArray;
    },

    /**
     * Stores a new live embed in MongoDB.
     * @param {string} messageId Discord message ID.
     * @param {string} channelId Discord channel ID.
     * @param {string} guildId Discord guild ID.
     * @param {string} createdBy User ID who created the embed.
     * @param {string} lastHash Hash of the current server state.
     */
    storeLiveEmbed: async function (messageId, channelId, guildId, createdBy, lastHash) {
        if (!liveEmbedConnected) {
            await liveEmbedClient.connect();
            liveEmbedConnected = true;
        }
        
        await liveEmbedClient
            .db(mongoDBName)
            .collection('live_embeds')
            .insertOne({
                messageId: messageId,
                channelId: channelId,
                guildId: guildId,
                createdBy: createdBy,
                lastHash: lastHash,
                createdAt: new Date()
            });
    },

    /**
     * Updates the hash for a live embed in MongoDB.
     * @param {string} messageId Discord message ID.
     * @param {string} newHash New hash of the server state.
     */
    updateLiveEmbedHash: async function (messageId, newHash) {
        if (!liveEmbedConnected) {
            await liveEmbedClient.connect();
            liveEmbedConnected = true;
        }
        
        await liveEmbedClient
            .db(mongoDBName)
            .collection('live_embeds')
            .updateOne({
                messageId: messageId
            }, {
                $set: {
                    lastHash: newHash,
                    lastUpdated: new Date()
                }
            });
    },

    /**
     * Removes a live embed from MongoDB.
     * @param {string} messageId Discord message ID.
     */
    removeLiveEmbed: async function (messageId) {
        if (!liveEmbedConnected) {
            await liveEmbedClient.connect();
            liveEmbedConnected = true;
        }
        
        await liveEmbedClient
            .db(mongoDBName)
            .collection('live_embeds')
            .deleteOne({
                messageId: messageId
            });
    },

};