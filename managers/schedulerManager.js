/*
 * File: schedulerManager.js
 * Project: valhalla-updater
 * File Created: Wednesday, 15th May 2024 10:14:14 pm
 * Author: flaasz
 * -----
 * Last Modified: Friday, 31st May 2024 2:06:42 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

//TODO Restart scheduler with checks
//TODO Automated perms on ptero for team!


const fs = require('fs');
const path = require('path');
const config = require('../config/config.json');
const schedulerConfig = config.scheduler;

module.exports = {
    loadSchedulers: function (init = false) {
        const schedulersPath = path.join(__dirname, '../schedulers');
        const schedulerFiles = fs.readdirSync(schedulersPath).filter(file => file.endsWith('.js'));

        let schedulers = 0;
        let activeSchedulers = 0;
        for (const file of schedulerFiles) {
            schedulers++;
            const filePath = path.join(schedulersPath, file);
            const scheduler = require(filePath);

            if ('name' in scheduler && 'start' in scheduler || 'defaultConfig' in scheduler) {
                if (!schedulerConfig[scheduler.name]) {
                    console.log(`No config found for ${scheduler.name} scheduler! Generating default config...`);
                    schedulerConfig[scheduler.name] = scheduler.defaultConfig;

                    const configPath = path.join(__dirname, '../config/config.json');
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
                }

                if (schedulerConfig[scheduler.name].active && !init) {
                    activeSchedulers++;
                    console.log(`Starting ${scheduler.name} scheduler...`);
                    scheduler.start(schedulerConfig[scheduler.name]);
                }
            } else {
                console.log(`[WARNING] The scheduler at ${filePath} is missing a required "name", "start" or "defaultConfig" property.`);
            }
        }

        if(!init) console.log(`Loaded ${schedulers} (${activeSchedulers} active) schedulers!`);
    }
};