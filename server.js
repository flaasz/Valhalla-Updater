/*
 * File: server.js
 * Project: Valhalla-Updater
 * File Created: Saturday, 11th May 2024 6:17:20 pm
 * Author: flaasz
 * -----
 * Last Modified: Wednesday, 29th May 2024 12:46:03 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const scheduler = require("./managers/schedulerManager");
const discord = require("./discord/bot");

discord.launchBot();
scheduler.loadSchedulers();