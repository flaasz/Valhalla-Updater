/*
 * File: test.js
 * Project: valhalla-updater
 * File Created: Saturday, 15th June 2024 1:39:17 am
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 15th June 2024 2:47:52 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

let a = require("./modules/advancedSend");

async function start() {
    const i = await a.sendCommand("aaeaa329", "forge tps");
    console.log("Response:", i);
}

start();