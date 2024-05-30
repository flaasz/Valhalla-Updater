/*
 * File: server.js
 * Project: valhalla-updater
 * File Created: Saturday, 11th May 2024 6:17:20 pm
 * Author: flaasz
 * -----
 * Last Modified: Thursday, 30th May 2024 11:50:56 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const scheduler = require("./managers/schedulerManager");
const discord = require("./discord/bot");
require("./modules/errorHandler");

discord.launchBot();
scheduler.loadSchedulers();

//TODO add config to gitignore and create config generator