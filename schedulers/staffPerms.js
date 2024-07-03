/*
 * File: staffPerms.js
 * Project: valhalla-updater
 * File Created: Wednesday, 3rd July 2024 9:36:20 pm
 * Author: flaasz
 * -----
 * Last Modified: Wednesday, 3rd July 2024 10:20:12 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const functions = require("../modules/functions");
const mongo = require("../modules/mongo");
const pterodactyl = require("../modules/pterodactyl");

module.exports = {
    name: "staffPerms",
    defaultConfig: {
        "active": true,
        "interval": 24,
        "staffMailList": [],
        "staffPermissions": [
            "control.console",
            "control.start",
            "control.stop",
            "control.restart",
            "file.create",
            "file.read",
            "file.read-content",
            "file.update",
            "file.delete",
            "file.archive",
            "file.sftp",
        ]
    },

    /**
     * Starts a scheduler that gives permissions for staff on pterodactyl.
     * @param {object} options Object containing options for the scheduler.
     */
    start: async function (options) {
        await functions.sleep(30000);
        this.givePerms(options);
        setInterval(() => this.givePerms(options), options.interval * 60 * 60 * 1000);
    },

    givePerms: async function (options) {

        console.log("Checking staff permissions...");
        const servers = await mongo.getServers();

        for (let server of servers) {
            //console.log(`Checking server ${server.name}`);
            const subUsers = await pterodactyl.listUsers(server.serverId);
            //console.log(subUsers.data);
            for (let staffMail of options.staffMailList) {

                if (subUsers.data.some(user => user.attributes.email === staffMail)) {
                    continue;
                }
                console.log(`User ${staffMail} does not have permissions for server ${server.name}! Adding...`);

                const userBody = {
                    "email": staffMail,
                    "permissions": options.staffPermissions
                };

                await pterodactyl.createSubUser(server.serverId, userBody);

                await functions.sleep(300);
            }
        }

    },
};