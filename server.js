/*
 * File: server.js
 * Project: valhalla-updater
 * File Created: Saturday, 11th May 2024 6:17:20 pm
 * Author: flaasz
 * -----
 * Last Modified: Friday, 14th June 2024 10:41:30 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

require("./modules/errorHandler");
require("./modules/initializer");
const sessionLogger = require("./modules/sessionLogger");
const scheduler = require("./managers/schedulerManager");
const api = require("./managers/apiManager");
const discord = require("./discord/bot");

sessionLogger.info('Server', 'Valhalla Updater initializing...');

// Start all services concurrently
(async () => {
    try {
        sessionLogger.info('Server', 'Starting Discord bot...');
        const discordPromise = discord.launchBot();

        sessionLogger.info('Server', 'Starting API server...');
        api.startServer();

        sessionLogger.info('Server', 'Loading schedulers...');
        scheduler.loadSchedulers();

        // Wait for Discord bot (with retry logic)
        await discordPromise;

        sessionLogger.info('Server', 'All services started successfully!');
    } catch (error) {
        sessionLogger.error('Server', 'Failed to start some services:', error.message);
        // Continue running even if Discord fails
    }
})();
