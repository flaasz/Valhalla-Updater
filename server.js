/*
 * File: server.js
 * Project: valhalla-updater
 * File Created: Saturday, 11th May 2024 6:17:20 pm
 * Author: flaasz
 * -----
 * Last Modified: Friday, 31st May 2024 12:58:25 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

require("./modules/errorHandler");
require("./modules/initializer");
const scheduler = require("./managers/schedulerManager");
const discord = require("./discord/bot");

discord.launchBot();
scheduler.loadSchedulers();
