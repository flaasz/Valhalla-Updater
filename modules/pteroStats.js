require('dotenv').config();
const {
    pterosocket
} = require('pterosocket');
const { pterodactylHostName } = require('../config/config.json').pterodactyl;

module.exports = class PteroStats {
    constructor() {
        this.cpu_absolute = 0;
        this.disk_bytes = 0;
        this.memory_bytes = 0;
        this.memory_limit_bytes = 0;
        this.network = {
            rx_bytes: 0,
            tx_bytes: 0
        };
        this.state = "offline";
        this.uptime = 0;
    }

    start(server) {
        const socket = new pterosocket(pterodactylHostName.replace(/\/$/, ""), process.env.PTERODACTYL_APIKEY, server);
        socket.on("stats", (data) => {
            this.cpu_absolute = data.cpu_absolute;
            this.disk_bytes = data.disk_bytes;
            this.memory_bytes = data.memory_bytes;
            this.memory_limit_bytes = data.memory_limit_bytes;
            this.network = data.network;
            this.state = data.state;
            this.uptime = data.uptime;
        });
    }

    getStats() {
        return {
            cpu_absolute: this.cpu_absolute,
            disk_bytes: this.disk_bytes,
            memory_bytes: this.memory_bytes,
            memory_limit_bytes: this.memory_limit_bytes,
            network: this.network,
            state: this.state,
            uptime: this.uptime
        };
    }
};