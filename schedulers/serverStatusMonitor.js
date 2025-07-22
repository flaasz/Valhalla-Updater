const mongo = require("../modules/mongo");
const { EmbedBuilder } = require("discord.js");
const crypto = require('crypto');
const sessionLogger = require("../modules/sessionLogger");
const { processServerUpdate, getServerStatus } = require("../modules/serverCrashDetector");

module.exports = {
    name: 'serverStatusMonitor',
    defaultConfig: {
        "active": true,
        "interval": 5 // 5 seconds
    },

    /**
     * Starts the server status monitoring scheduler.
     * @param {object} options Object containing options for the scheduler.
     */
    start: async function (options) {
        sessionLogger.info('ServerStatusMonitor', `Server Status Monitor started - checking every ${options.interval} seconds`);
        
        // Start the main update loop - convert seconds to milliseconds
        setInterval(() => this.checkAndUpdateEmbeds(), options.interval * 1000);
        
        // Run initial check after a short delay
        setTimeout(() => this.checkAndUpdateEmbeds(), options.interval * 1000);
    },

    /**
     * Main function that checks for server status changes and updates live embeds.
     */
    checkAndUpdateEmbeds: async function () {
        try {
            // Get current server data (same pattern as checkForUpdates scheduler)
            let serverList = await mongo.getServers();
            await require('../modules/functions').sleep(10);
            let shardList = await mongo.getShards();
            
            // Process crash detection for all servers
            await this.processCrashDetection(serverList, shardList);
            
            // Get all live embeds from database  
            let liveEmbeds = await mongo.getLiveEmbeds();
            
            if (liveEmbeds.length === 0) {
                return; // No live embeds to monitor
            }
            
            // Generate current state hash (now includes crash status)
            const currentHash = generateServerStateHash(serverList, shardList);
            
            // Check if ANY embed needs updating (compare against any stored hash)
            const needsUpdate = liveEmbeds.some(embed => embed.lastHash !== currentHash);
            
            if (!needsUpdate) {
                return; // No changes detected, skip all updates
            }
            
            sessionLogger.info('ServerStatusMonitor', 'Server status changes detected, updating live embeds...');
            
            // Update all embeds that need updating
            for (const embedData of liveEmbeds) {
                if (embedData.lastHash !== currentHash) {
                    await updateLiveEmbed(embedData, serverList, shardList, currentHash);
                }
            }
        } catch (error) {
            sessionLogger.error('ServerStatusMonitor', 'Error in checkAndUpdateEmbeds:', error.message);
        }
    },

    /**
     * Process crash detection for all servers
     */
    processCrashDetection: async function (serverList, shardList) {
        try {
            for (const server of serverList) {
                if (server.excludeFromServerList) continue;
                
                // Check if server is online (in shard list)
                const isOnline = shardList.some(shard => shard.name === server.name);
                
                // Process crash detection for this server
                await processServerUpdate(server, isOnline);
            }
        } catch (error) {
            sessionLogger.error('ServerStatusMonitor', 'Error in crash detection processing:', error.message);
        }
    }
};

/**
 * Updates a specific live embed with new server data.
 * @param {object} embedData The embed data from database.
 * @param {Array} serverList Current server list.
 * @param {Array} shardList Current shard list.
 * @param {string} newHash New server state hash.
 */
async function updateLiveEmbed(embedData, serverList, shardList, newHash) {
    try {
        // Get Discord client from the bot instance
        const { getClient } = require('../discord/bot');
        const client = await getClient();

        // Fetch the channel and message
        const channel = await client.channels.fetch(embedData.channelId);
        if (!channel) {
            sessionLogger.warn('ServerStatusMonitor', `Channel ${embedData.channelId} not found, removing embed from database`);
            await mongo.removeLiveEmbed(embedData.messageId);
            return;
        }

        const message = await channel.messages.fetch(embedData.messageId);
        if (!message) {
            sessionLogger.warn('ServerStatusMonitor', `Message ${embedData.messageId} not found, removing embed from database`);
            await mongo.removeLiveEmbed(embedData.messageId);
            return;
        }

        // Generate updated embed
        const updatedEmbed = generateServerEmbed(serverList, shardList);
        
        // Update the message
        await message.edit({ embeds: [updatedEmbed] });
        
        // Update the hash in database
        await mongo.updateLiveEmbedHash(embedData.messageId, newHash);
        
        sessionLogger.info('ServerStatusMonitor', `Updated live embed ${embedData.messageId}`);
        
    } catch (error) {
        if (error.code === 10008 || error.code === 10003) {
            // Message or channel not found
            sessionLogger.warn('ServerStatusMonitor', `Message/Channel not found, removing embed ${embedData.messageId} from database`);
            await mongo.removeLiveEmbed(embedData.messageId);
        } else if (error.code === 50013) {
            // Missing permissions
            sessionLogger.warn('ServerStatusMonitor', `Missing permissions to update embed ${embedData.messageId}`);
        } else {
            sessionLogger.error('ServerStatusMonitor', `Error updating live embed ${embedData.messageId}:`, error);
        }
    }
}

/**
 * Generates the server status embed.
 * @param {Array} serverList Array of server objects.
 * @param {Array} shardList Array of shard objects.
 * @returns {EmbedBuilder} The generated embed.
 */
function generateServerEmbed(serverList, shardList) {
    const embed = new EmbedBuilder()
        .setColor(0x9c59b6)
        .setTitle('Server List')
        .setTimestamp()
        .setFooter({
            text: "To see players online use /online"
        });

    let onlineCount = 0;
    let serverCount = 0;
    let versionObj = {};

    // Build server data structure
    for (let server of serverList) {
        if (server.excludeFromServerList) continue;
        serverCount++;

        if (!versionObj[server.server_version]) versionObj[server.server_version] = [];
        versionObj[server.server_version].push(server);
    }

    // Sort versions and build embed fields
    const sortedVersions = Object.keys(versionObj).sort((a, b) => compareVersions(b, a));
    const excludedTags = ["BINGO", "ALP"];
    
    for (const key of sortedVersions) {
        let str = "";

        for (let s of versionObj[key]) {
            var statusEmoji = "<:c:1389899748370157609>";

            // Check if server is online
            const isOnline = shardList.some(obj => obj.name === s.name);
            if (isOnline) {
                onlineCount++;
                statusEmoji = "<:u:1389899745866027090>";
            }

            // Get crash status from crash detector
            const crashStatus = getServerStatus(s.serverId);
            let crashStatusText = "";
            
            if (crashStatus) {
                // Override emoji based on crash status
                if (crashStatus.currentState === 'starting' && crashStatus.recentCrashes > 0) {
                    statusEmoji = "<:c:1389899748370157609>"; // Crashed but restarting
                } else if (crashStatus.recentCrashes >= 3) {
                    statusEmoji = "<:c:1389899748370157609>"; // Crashed (crash loop)
                }
                
                // Get status text (e.g., "(CRASHED, starting back!)")
                crashStatusText = crashStatus.statusText || "";
            }

            if (s.tag == "PLUS") statusEmoji = "";
            if (!excludedTags.includes(s.tag) && !s.early_access) {
                str += `- **${s.tag.toUpperCase()} | ${s.name}** ${statusEmoji}${crashStatusText}\n ${s.tag.toLowerCase()}.valhallamc.io *(v.${s.modpack_version})*\n`;
            }
        }

        if (str) {
            embed.addFields({
                name: `Minecraft ${key}`,
                value: str
            });
        }
    }

    embed.setDescription(`Servers online: ${onlineCount}\n*Last updated: <t:${Math.floor(Date.now() / 1000)}:R>*`);

    return embed;
}

/**
 * Generates a hash of the current server state for change detection.
 * @param {Array} serverList Array of server objects.
 * @param {Array} shardList Array of shard objects.
 * @returns {string} SHA256 hash of the server state.
 */
function generateServerStateHash(serverList, shardList) {
    const stateData = {
        servers: serverList.map(server => {
            const crashStatus = getServerStatus(server.serverId);
            return {
                tag: server.tag,
                name: server.name,
                modpack_version: server.modpack_version,
                server_version: server.server_version,
                excludeFromServerList: server.excludeFromServerList,
                early_access: server.early_access,
                // Include crash status in hash for real-time updates
                crashState: crashStatus ? {
                    currentState: crashStatus.currentState,
                    recentCrashes: crashStatus.recentCrashes,
                    statusText: crashStatus.statusText
                } : null
            };
        }),
        shards: shardList.map(shard => ({
            name: shard.name
        }))
    };

    return crypto.createHash('sha256').update(JSON.stringify(stateData)).digest('hex');
}

/**
 * Compares two version strings.
 * @param {string} a First version string.
 * @param {string} b Second version string.
 * @returns {number} Comparison result.
 */
function compareVersions(a, b) {
    const versionA = a.split('.').map(Number);
    const versionB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
        if (versionA[i] === undefined) return -1;
        if (versionB[i] === undefined) return 1;

        if (versionA[i] < versionB[i]) return -1;
        if (versionA[i] > versionB[i]) return 1;
    }

    return 0;
}