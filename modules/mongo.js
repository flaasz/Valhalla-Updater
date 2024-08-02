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

module.exports = {

    /**
     * Gets all current servers data from MongoDB.
     * @returns Array of objects containing the server data.
     */
    getServers: async function () {
        await mongoClient.connect();
        const shardsArray = await mongoClient
            .db(mongoDBName)
            .collection(mongoDBshardsCollection)
            .find({}).toArray();

        const serversArray = await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .find({}).toArray();

        const combinedArray = shardsArray.map(shard => {
            const serverInfo = serversArray.find(server => server._id.toString() === shard.server.toString());
            return { ...shard, ...serverInfo };
        });

        mongoClient.close();
        return combinedArray;
    },

    /**
     * Gets reboot statistics for a server.
     * @param {string} serverId Id of the server.
     * @returns Object containing reboot statistics.
     */
    getRebootStats: async function (serverId) {
        await mongoClient.connect();
        const server = await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .findOne({ serverId: serverId }, { projection: { totalReboots: 1, rebootHistory: 1 } });
        mongoClient.close();
        return server;
    },

    /**
     * Gets CPU usage history for a server.
     * @param {string} serverId Id of the server.
     * @returns Array of CPU usage entries.
     */
    getCPUHistory: async function (serverId) {
        await mongoClient.connect();
        const server = await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .findOne({ serverId: serverId });
        mongoClient.close();
        return server.cpuHistory || [];
    },

    /**
     * Updates CPU usage history for a server.
     * @param {string} serverId Id of the server.
     * @param {Array} cpuHistory Array of CPU usage entries.
     */
    updateCPUHistory: async function (serverId, cpuHistory) {
        await mongoClient.connect();
        await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .updateOne(
                { serverId: serverId },
                { $set: { cpuHistory: cpuHistory } }
            );
        mongoClient.close();
    },

    /**
     * Logs a reboot event for a server.
     * @param {string} serverId Id of the server.
     */
    logReboot: async function (serverId, reason, duration) {
        await mongoClient.connect();
        await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .updateOne(
                { serverId: serverId },
                { 
                    $push: { 
                        rebootHistory: { 
                            timestamp: new Date(),
                            reason: reason,
                            duration: duration
                        } 
                    },
                    $inc: { totalReboots: 1 }
                }
            );
        mongoClient.close();
    },

    getRebootStats: async function (serverId) {
        await mongoClient.connect();
        const server = await mongoClient
            .db(mongoDBName)
            .collection(mongoDBserversCollection)
            .findOne(
                { serverId: serverId },
                { projection: { totalReboots: 1, rebootHistory: { $slice: -30 } } }
            );
        mongoClient.close();

        const rebootHistory = server.rebootHistory || [];
        const totalReboots = server.totalReboots || 0;
        const lastReboot = rebootHistory[rebootHistory.length - 1];
        const averageDuration = rebootHistory.reduce((sum, reboot) => sum + (reboot.duration || 0), 0) / rebootHistory.length;

        return {
            totalReboots,
            lastReboot,
            averageDuration,
            rebootHistory,
            rebootFrequency: totalReboots / (30 * 24 * 60 * 60 * 1000) * 1000 * 60 * 60 * 24 // Reboots per day
        };
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
     * Gets all tickets user closed or participated in by user from MongoDB.
     * @param {*} id Id of the user.
     * @param {*} username Username of the user.
     * @returns Array of objects containing the tickets data.
     */
    getTickets: async function (id, username) {
        await mongoClient.connect();
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
        mongoClient.close();
        return results;
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
