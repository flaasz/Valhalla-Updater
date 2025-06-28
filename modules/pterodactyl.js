/*
 * File: pterodactyl.js
 * Project: valhalla-updater
 * File Created: Saturday, 11th May 2024 8:15:21 pm
 * Author: flaasz
 * -----
 * Last Modified: Wednesday, 3rd July 2024 10:37:31 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const axios = require('axios');
const progress = require('progress');
const sessionLogger = require('./sessionLogger');
require('dotenv').config();


const pterodactylAPIKey = process.env.PTERODACTYL_APIKEY;
const {
    pterodactylHostName
} = require("../config/config.json").pterodactyl;

const header = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": `Bearer ${pterodactylAPIKey}`,
};


module.exports = {
    /**
     * Gets the status of a server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @returns Object containing the status of the server.
     */
    getStatus: async function (serverID) {
        try {
            let response = await axios.get(`${pterodactylHostName}api/client/servers/${serverID}/resources`, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Gets server uptime in hours
     * @param {string} serverID Id of the server on Pterodactyl.
     * @returns {number} Server uptime in hours, or 0 if server is not running
     */
    getServerUptime: async function (serverID) {
        try {
            const status = await this.getStatus(serverID);
            
            // DEBUG: Log the full response to see what we actually get
            sessionLogger.info('Pterodactyl', `Server ${serverID} full response:`, JSON.stringify(status, null, 2));
            
            if (!status || status.attributes.current_state !== 'running') {
                sessionLogger.info('Pterodactyl', `Server ${serverID}: Not running (state: ${status?.attributes?.current_state})`);
                return 0; // Server not running = 0 uptime
            }
            
            // Log what's in resources
            sessionLogger.info('Pterodactyl', `Server ${serverID} resources:`, JSON.stringify(status.attributes.resources, null, 2));
            
            // Look for ANY uptime field in the actual response
            const resources = status.attributes.resources || {};
            
            // Check for common uptime field names
            if (resources.uptime !== undefined) {
                // Pterodactyl typically returns uptime in milliseconds
                const uptimeMs = resources.uptime;
                const uptimeHours = Math.floor(uptimeMs / (1000 * 3600));
                sessionLogger.info('Pterodactyl', `Server ${serverID}: Found uptime field = ${uptimeMs}ms = ${uptimeHours}h`);
                return uptimeHours;
            }
            
            if (resources.uptime_in_seconds !== undefined) {
                const uptimeSeconds = resources.uptime_in_seconds;
                const uptimeHours = Math.floor(uptimeSeconds / 3600);
                sessionLogger.info('Pterodactyl', `Server ${serverID}: Found uptime_in_seconds = ${uptimeSeconds}s = ${uptimeHours}h`);
                return uptimeHours;
            }
            
            // Log ALL available fields
            sessionLogger.warn('Pterodactyl', `Server ${serverID}: No uptime field found. ALL available fields: ${Object.keys(resources).join(', ')}`);
            
            // Return 0 for safety when no uptime is found
            return 0;
            
        } catch (error) {
            sessionLogger.error('Pterodactyl', `Error getting uptime for server ${serverID}`, error.message);
            return 0; // Return 0 on error to be safe
        }
    },

    /**
     * Gets the one-time download link of a file.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} path Path to the file to download on Pterodactyl.
     * @returns URL to download the file.
     */
    getDownloadLink: async function (serverID, path) {
        path = path.replace("+", "%2B");
        //console.log(`${pterodactylHostName}api/client/servers/${serverID}/files/download?file=/${path}`);
        try {
            let response = await axios.get(`${pterodactylHostName}api/client/servers/${serverID}/files/download?file=${path}`, {
                headers: header
            });
            //console.log(response);
            return response.data.attributes.url;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Gets the one-time upload link of a file.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @returns URL of the upload link.
     */
    getUploadLink: async function (serverID) {
        try {
            let response = await axios.get(`${pterodactylHostName}api/client/servers/${serverID}/files/upload`, {
                headers: header
            });
            //console.log(response);
            return response.data.attributes.url;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Sends a power action to be executed on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} action Action to be executed on the server. Options: "start", "stop", "restart", "kill".
     * @returns 
     */
    sendPowerAction: async function (serverID, action) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/power`, {
                signal: action
            }, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Sends a request to compress a list of files on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {Array} fileList List of files to compress.
     * @param {string} listPath Path to the folder containing the files to compress. Defaults to the root directory.
     * @returns 
     */
    compressFile: async function (serverID, fileList, listPath = "/", ) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/files/compress`, {
                root: listPath,
                files: fileList,
            }, {
                headers: header
            });
            //console.log(response);
            return response.data.attributes.name;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Sends a request to decompress a file on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} fileName Name of the file to decompress.
     * @param {string} filePath Path to the folder containing the file to decompress. Defaults to the root directory.
     * @returns 
     */
    decompressFile: async function (serverID, fileName, filePath = "/") {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/files/decompress`, {
                root: filePath,
                file: fileName,
            }, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Sends a request to delete a list of files on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {Array} fileList List of files to delete.
     * @param {string} listPath Path to the folder containing the files to delete. Defaults to the root directory.
     * @returns 
     */
    deleteFile: async function (serverID, fileList, filePath = "/") {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/files/delete`, {
                root: filePath,
                files: fileList,
            }, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Sends a request to rename the specified file on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} path Path to the file to rename on the server.
     * @param {string} newName New name of the file.
     * @param {string} filePath Path to the file to rename. Defaults to the root directory.
     * @returns 
     */
    renameFile: async function (serverID, path, newName, filePath = "/") {
        try {
            let response = await axios.put(`${pterodactylHostName}api/client/servers/${serverID}/files/rename`, {
                root: filePath,
                files: path,
                name: newName
            }, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Executes a command on the server.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {string} command Command to be executed on the server.
     */
    sendCommand: async function (serverID, command) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/command`, {
                command: command,
            }, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            if (error.response.status != 502) {
                console.log(error.response.data);
            }
        }
    },

    /**
     * Lists all subusers of a server.
     * @param {*} serverID Id of the server on Pterodactyl.
     * @returns Object containing the list of subusers.
     */
    listUsers: async function (serverID) {
        try {
            let response = await axios.get(`${pterodactylHostName}api/client/servers/${serverID}/users`, {
                headers: header
            });
            //console.log(response);
            return response.data;
        }
        catch (error) {
            console.error(error.response.data);
        }
    }, 

    /**
     * Creates a subuser on the server.
     * @param {*} serverID Id of the server on Pterodactyl.
     * @param {*} subUserData Object containing the subuser data.
     */
    createSubUser: async function (serverID, subUserData) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/users`, subUserData, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Updates a subuser on the server.
     * @param {*} serverID Id of the server on Pterodactyl.
     * @param {*} subUserID Id of the subuser on Pterodactyl.
     * @param {*} subUserData Object containing the updated subuser data.
     */
    updateSubUser: async function (serverID, subUserID, subUserData) {
        try {
            let response = await axios.post(`${pterodactylHostName}api/client/servers/${serverID}/users/${subUserID}`, subUserData, {
                headers: header
            });
            //console.log(response);
            return response.data;
        } catch (error) {
            console.error(error.response.data);
        }
    },

    /**
     * Begins a shutdown sequence on the server. If the server takes longer than the specified time to shut down, it will wait for it to idle and forcibly kill it.
     * @param {string} serverID Id of the server on Pterodactyl.
     * @param {number} timeToKill Time in seconds to wait before killing the server. Default is 30 seconds.
     * @param {number} interval Interval in seconds to check the server status. Default interval is 3 seconds.
     */
    shutdown: async function (serverID, timeToKill = 30, interval = 3) {
        const progressBar = new progress(`Shutting down the server [:bar] :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 100,
            total: timeToKill + 1
        });

        let iterator = 0;
        await this.sendPowerAction(serverID, "stop");

        return new Promise((resolve, reject) => {
            let shutdownSequence = setInterval(async () => {
                try {
                    let status = await this.getStatus(serverID);

                    if (status.attributes.current_state === "offline") {
                        progressBar.update(1);
                        clearInterval(shutdownSequence);
                        resolve();
                    } else if (iterator < timeToKill) {
                        progressBar.tick(interval);
                        iterator += interval;
                    }
                    if (iterator >= timeToKill) {
                        progressBar.update(0.99);
                        console.log("\nThis is taking longer than expected...");
                        process.stdout.moveCursor(76, -2);

                        if (status.attributes.resources.cpu_absolute < 10) {
                            progressBar.update(1);
                            console.log("\nServer is idling. Killing it...");
                            await this.sendPowerAction(serverID, "kill");
                            clearInterval(shutdownSequence);
                            resolve();
                        }
                    }
                } catch (error) {
                    clearInterval(shutdownSequence);
                    reject(error);
                }
            }, interval * 1000);
        });
    },

    /**
     *  Discovers all available nodes from Pterodactyl admin API
     * @returns {Array} Array of node objects with resource information
     */
    getNodes: async function () {
        try {
            const response = await axios.get(`${pterodactylHostName}api/application/nodes`, {
                headers: header
            });
            
            return response.data.data.map(node => ({
                id: node.attributes.uuid,
                name: node.attributes.name,
                fqdn: node.attributes.fqdn,
                memory: {
                    total: node.attributes.memory,
                    allocated: node.attributes.allocated_resources.memory
                },
                disk: {
                    total: node.attributes.disk,
                    allocated: node.attributes.allocated_resources.disk
                },
                capacity: 4 // Default safe concurrent server capacity (configurable via maxConcurrentReboots)
            }));
        } catch (error) {
            console.error('Error fetching nodes:', error.response?.data || error.message);
            return [];
        }
    },

    /**
     *  Gets the node assignment for a specific server
     * @param {string} serverID Server ID
     * @returns {string|null} Node UUID/ID or null if not found
     */
    getServerNode: async function (serverID) {
        try {
            const response = await axios.get(`${pterodactylHostName}api/client/servers/${serverID}`, {
                headers: header
            });
            
            return response.data.attributes.node;
        } catch (error) {
            console.error(`Error getting node for server ${serverID}:`, error.response?.data || error.message);
            return null;
        }
    }

};