/*
 * File: stats.js
 * Project: valhalla-updater
 * File Created: Thursday, 13th June 2024 4:33:34 pm
 * Author: flaasz
 * -----
 * Last Modified: Thursday, 13th June 2024 7:47:54 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */


const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const mongo = require('../../modules/mongo');
const moment = require('moment');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Shows server stats!')
        .setDefaultMemberPermissions(8192),
    async execute(interaction) {
        const shardList = await mongo.getShards();

        const embed = new EmbedBuilder()
            .setColor(0x9c59b6)
            .setTitle('Server Stats')
            .setTimestamp()
            .setFooter({
                text: "Issues? Create a ticket!"
            });

        let versionObj = {};


        for (let s of shardList) {

            if (!s.early_access) {
                embed.addFields({
                    name: s.name,
                    value: `**Uptime:** ${humanReadableTimeDifference(s.started, Date.now())}\n**TPS:** ${Math.round(s.tps * 100) / 100}`,
                });
            }
        }

        return interaction.reply({
            embeds: [embed]
        });
    },
};


function humanReadableTimeDifference(startTimestamp, endTimestamp) {
    const start = moment(startTimestamp);
    const end = moment(endTimestamp);

    const years = end.diff(start, 'years');
    start.add(years, 'years');

    const months = end.diff(start, 'months');
    start.add(months, 'months');

    const days = end.diff(start, 'days');
    start.add(days, 'days');

    const hours = end.diff(start, 'hours');
    start.add(hours, 'hours');

    const minutes = end.diff(start, 'minutes');
    start.add(minutes, 'minutes');

    const seconds = end.diff(start, 'seconds');

    let humanReadableString = '';
    if (years) humanReadableString += `${years}y `;
    if (months) humanReadableString += `${months}mo `;
    if (days) humanReadableString += `${days}d `;
    if (hours) humanReadableString += `${hours}h `;
    if (minutes) humanReadableString += `${minutes}m `;
    if (seconds) humanReadableString += `${seconds}s `;

    humanReadableString = humanReadableString.trim();

    return humanReadableString || '0s';
}