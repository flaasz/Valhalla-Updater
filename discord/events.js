/*
 * File: events.js
 * Project: Valhalla-Updater
 * File Created: Friday, 17th May 2024 2:08:58 am
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 25th May 2024 4:05:25 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const fs = require('fs');
const path = require('path');
const sessionLogger = require('../modules/sessionLogger');

module.exports = {
    loadEventFiles: function (client) {
        const eventsPath = path.join(__dirname, 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
        
        let events = 0;
        for (const file of eventFiles) {
            events++;
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }

        sessionLogger.info('EventLoader', `Loaded ${events} events`); 
    }
};