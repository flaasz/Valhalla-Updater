/*
 * File: error.js
 * Project: valhalla-updater
 * File Created: Thursday, 30th May 2024 11:29:57 pm
 * Author: flaasz
 * -----
 * Last Modified: Friday, 31st May 2024 4:47:44 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const fs = require('fs');
const path = require('path');
const exitOnError = require('../config/config.json').base.exitOnError;

function logError(error) {
    const timestamp = new Date().toISOString();
    const errorMessage = `
        Timestamp: ${timestamp}
        Error Name: ${error.name}
        Error Message: ${error.message}
        Error Stack: ${error.stack}

        Process Info:
        Node Version: ${process.version}
        Platform: ${process.platform}
        PID: ${process.pid}

        Memory Usage:
        RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB
        Heap Total: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB
        Heap Used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
        External: ${Math.round(process.memoryUsage().external / 1024 / 1024)} MB
    `.trim();

    const logsDir = 'crash-logs';
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir);
    }

    const logFilePath = path.join(logsDir, `crash_${timestamp.split(".")[0].replace(/:/g, "-")}.log`);
    fs.writeFileSync(logFilePath, errorMessage);

    const files = fs.readdirSync(logsDir)
        .map(file => ({
            file,
            time: fs.statSync(path.join(logsDir, file)).mtime.getTime()
        }))
        .sort((a, b) => a.time - b.time);

    if (files.length > 10) {
        fs.unlinkSync(path.join(logsDir, files[0].file));
    }

    if (!exitOnError) {
        console.error(`Error occurred! Check ${logFilePath} for more info.`);
        return;
    }
    process.exit(1);
}

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    logError(error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    logError(reason instanceof Error ? reason : new Error(reason));
});