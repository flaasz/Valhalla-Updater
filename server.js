/*
 * File: server.js
 * Project: valhalla-updater
 * File Created: Saturday, 11th May 2024 6:17:20 pm
 * Author: flaasz
 * -----
 * Last Modified: Friday, 14th June 2024 1:20:31 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

require("./modules/errorHandler");
require("./modules/initializer");
const scheduler = require("./managers/schedulerManager");
const api = require("./managers/apiManager");
const discord = require("./discord/bot");

discord.launchBot();
api.startServer();
scheduler.loadSchedulers();
