/*
 * File: initializer.js
 * Project: valhalla-updater
 * File Created: Friday, 31st May 2024 12:08:03 am
 * Author: flaasz
 * -----
 * Last Modified: Friday, 31st May 2024 12:57:49 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const envVars = ['MONGODB_URL', 'PTERODACTYL_APIKEY', 'DISCORD_TOKEN', 'CURSEFORGE_APIKEY'];


function generateEnvFile() {

    let envContent = "";

    for (const key of envVars) {
        envContent += `${key}=\n\n`;
    }

    const envFilePath = path.join(__dirname, '../.env');

    fs.writeFileSync(envFilePath, envContent.trim(), (err) => {
        if (err) {
            return console.error('Error writing .env file:', err);
        }
        console.log('.env file created successfully!');
    });
}

function generateConfigFiles() {
    
    const configsDir = "config";
    if (!fs.existsSync(configsDir)) {
        fs.mkdirSync(configsDir);
    }

    const messagesContent = {
        alertScheduledUpdate: "tellraw @a {\"text\":\"This server has begun an automated update process. Please update your client to v[NEWVERSION]. This process can take up to 15 minutes!\",\"color\":\"red\"}",
        alertScheduledReboot: "tellraw @a {\"text\":\"This server has begun a scheduled reboot process. Please disconnect. This process can take up to 5 minutes!\",\"color\":\"red\"}",
        alertCakeDrop: "tellraw @a {\"text\":\"Cake drop!\",\"color\":\"green\"}",
        updateMessage: "# <a:Update:1242446803345866883><a:U_:1242446802083385426><a:pd:1242446800586280960><a:ate:1242446799093104650>\n\nHey! **[PACKNAME]** server has been updated! \n## v[OLDVERSION] -> v[NEWVERSION]\n\n[SUMMARY]\nLearn more here: [Changelog](<[CHANGELOGURL]>)\n\nHaving issues? Make a ticket on <#1113399230359408711>. \n\n[PINGROLE]"
    };

    const messagesFilePath = path.join(__dirname, '../config/messages.json');

    fs.writeFileSync(messagesFilePath, JSON.stringify(messagesContent, null, 4), (err) => {
        if (err) {
            return console.error('Error writing messages.json file:', err);
        }
        console.log('messages.json file created successfully!');
    });

    const configContent = {
        "discord": {
            "active": true,
            "announcementChannelId": "",
            "staffChannelId": ""
        },
        "pterodactyl": {
            "active": true,
            "pterodactylHostName": "",
            "velocityID": ""
        },
        "mongodb": {
            "active": true,
            "mongoDBName": "",
            "mongoDBserversCollection": ""
        },
        "scheduler": {}
    };

    const configFilePath = path.join(__dirname, '../config/config.json');

    fs.writeFileSync(configFilePath, JSON.stringify(configContent, null, 4), (err) => {
        if (err) {
            return console.error('Error writing config.json file:', err);
        }
        console.log('config.json file created successfully!');
    });
}

if (!fs.existsSync(path.join(__dirname, '../.env'))) {
    console.error("No .env file found! Generating one...");
    generateEnvFile();
}

if (!fs.existsSync(path.join(__dirname, '../config/config.json')) || !fs.existsSync(path.join(__dirname, '../config/messages.json'))) {
    console.error("No config files found! Generating them...");
    generateConfigFiles();
}

let configFine = true;
for (const key of envVars) {
    if (!process.env[key]) {
        console.error(`Please fill out the .env file! Missing: ${key}`);
        configFine = false;
    }
}

let messages = require("../config/messages.json");

for (let key in messages) {
    if (messages[key] === null || messages[key] === '') {
        console.error(`Please fill out the /config/messages.json file! Missing: ${key}`);
        configFine = false;
        break;
    }
}

let config = require("../config/config.json");

function checkConfig(config) {

    for (let key in config) {

        const value = config[key];

        if (typeof value === 'object' && value !== null) {
            checkConfig(value);
        } else {
            if (value === null || value === '') {
                console.error(`Please fill out the /config/config.json file! Missing: ${key}`);
                configFine = false;
                break;
            }
        }
    }

}

checkConfig(config);

if (!configFine) process.exit(0);
console.log("Initializer complete!");