/*
 * File: tickets.js
 * Project: valhalla-updater
 * File Created: Thursday, 25th July 2024 5:36:52 pm
 * Author: flaasz
 * -----
 * Last Modified: Thursday, 25th July 2024 5:48:32 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const {
    SlashCommandBuilder
} = require('discord.js');
const mongo = require("../../modules/mongo");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Show the amount of solved tickets.')
        .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
        .setDefaultMemberPermissions(128),
    async execute(interaction) {
        const target = interaction.options.getUser('user');
        //console.log(target);

        const tickets = await mongo.getTickets(target.id, target.username);

        //console.log(tickets);

        let ticketCount = tickets[0].length;
        let contributedTickets = tickets[1].length;


        let ticketMessages = 0;

        for (let t of tickets[1]) {
            ticketMessages += t.users_involved[target.id];
        }

        //console.log(ticketMessages);

        let lastTicket = tickets[0][tickets[0].length - 1];

        //console.log(lastTicket);

        if (ticketCount == 0) return interaction.reply({
            content: `**${target.username}** did not close any tickets, and contributed to ${contributedTickets} tickets.\nOverall, they sent ${ticketMessages} messages across all tickets.`
        });

        let lastTicketDate = new Date(lastTicket.closed).getTime().toString().slice(0, -3);

        return interaction.reply({
            content: `**${target.username}** closed ${ticketCount} tickets, and contributed to ${contributedTickets} tickets.\nOverall, they sent ${ticketMessages} messages across all tickets.\nThe last ticket closed by them was <t:${lastTicketDate}:R>.`
        });
    },
};