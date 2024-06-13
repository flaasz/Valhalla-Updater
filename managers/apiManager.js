/*
 * File: apiManager.js
 * Project: valhalla-updater
 * File Created: Friday, 14th June 2024 12:29:18 am
 * Author: flaasz
 * -----
 * Last Modified: Friday, 14th June 2024 1:32:47 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const webApiPort = require("../config/config.json").webApi.port;
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

module.exports = {
    startServer: async function () {

        let output = {
            name: "",
            content: "",
            avatar: "",
            bonus: "",
        };

        app.post('/post', async function (req, res) {
            console.log(req.body.data);
            const data = req.body.data;
            if (!data) return res.json({
                success: true
            });

            try {
                //console.log(data);
                const obj = JSON.parse(data);
                console.log(obj);
                if (obj.verification_token != kofiToken) return;
                output.name = "Ko-fi";
                if (obj.message) {
                    output.content = `**${obj.from_name}** just donated **€${obj.amount}**: *${obj.message}*`;
                    //sendToMc.alert(`[Ko-fi] ${obj.from_name} just donated €${obj.amount}: ${obj.message}`);
                } else {
                    output.content = `**${obj.from_name}** just donated **€${obj.amount}**!`;
                    //sendToMc.alert(`[Ko-fi] ${obj.from_name} just donated €${obj.amount}!`);
                }
                output.avatar = "https://uploads-ssl.webflow.com/5c14e387dab576fe667689cf/61e1116779fc0a9bd5bdbcc7_Frame%206.png";
                //sendMessage(output);

                //encoder.encodeAnnouncement(output.content); 
            } catch (err) {
                console.error(err);
                return res.json({
                    success: false,
                    error: err
                });
            }
            return res.json({
                success: true
            });
        });


        app.use('/', async function (req, res) {
            res.json({
                message: "ValhallaMC api server is online!"
            });
            return;
        });


        app.listen(webApiPort, function () {
            console.log(`Web Api Server online on port ${webApiPort}`);
        });
    }
};