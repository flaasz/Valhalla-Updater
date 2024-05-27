/*
 * File: cakeDrop.js
 * Project: Valhalla-Updater
 * File Created: Monday, 27th May 2024 8:35:46 pm
 * Author: flaasz
 * -----
 * Last Modified: Monday, 27th May 2024 9:58:48 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const functions = require("../modules/functions");
const mongo = require("../modules/mongo");
const pterodactyl = require("../modules/pterodactyl");
const {
    alertCakeDrop
} = require("../config/messages.json");

module.exports = {
    name: "cakeDrop",
    defaultConfig: {
        "active": true,
        "interval": 120,
        "min": 1,
        "max": 10,
        "chance": 3
    },

    /**
     * Starts a scheduler that has a chance to give players on the servers a random amount of cake.
     * @param {object} options Object containing options for the scheduler.
     */
    start: async function (options) {
        
        async function dropCake() {

            const randomNumber = Math.random();

            if (randomNumber < 1 / options.chance) {
                console.log("Attempting to drop cake... Dropping cake!");

                let cakeAmount = Math.floor(Math.random() * (options.max - options.min + 1)) + options.min;

                let servers = await mongo.getServers();


                for (let server of servers) {
                    await pterodactyl.sendCommand(server.serverId, alertCakeDrop);

                    for (let i = 0; i < cakeAmount; i++) {
                        await pterodactyl.sendCommand(server.serverId, `give @a minecraft:cake 1`);
                        await functions.sleep(200);
                    }
                }
                console.log(`Dropped ${cakeAmount} cakes!`);
            } else {
                console.log("Attempting to drop cake... No cake dropped.");
            }
        }

        //dropCake();
        setInterval(dropCake, options.interval * 60 * 1000);
    }

};