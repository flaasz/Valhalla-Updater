const mongo = require("../modules/mongo");
const { EmbedBuilder } = require("discord.js");
const crypto = require('crypto');

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
        console.log(`Server Status Monitor started - checking every ${options.interval} seconds`);
        
        // Start the main update loop - convert seconds to milliseconds
        setInterval(this.checkAndUpdateEmbeds, options.interval * 1000);
        
        // Run initial check after a short delay
        setTimeout(this.checkAndUpdateEmbeds, options.interval * 1000);
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
            
            // Get all live embeds from database  
            let liveEmbeds = await mongo.getLiveEmbeds();
            
            if (liveEmbeds.length === 0) {
                return; // No live embeds to monitor
            }
            
            // Generate current state hash
            const currentHash = generateServerStateHash(serverList, shardList);
            
            // Check if ANY embed needs updating (compare against any stored hash)
            const needsUpdate = liveEmbeds.some(embed => embed.lastHash !== currentHash);
            
            if (!needsUpdate) {
                return; // No changes detected, skip all updates
            }
            
            console.log('Server status changes detected, updating live embeds...');
            
            // Update all embeds that need updating
            for (const embedData of liveEmbeds) {
                if (embedData.lastHash !== currentHash) {
                    await updateLiveEmbed(embedData, serverList, shardList, currentHash);
                }
            }
        } catch (error) {
            console.error('Error in serverStatusMonitor.checkAndUpdateEmbeds:', error.message);
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
            console.warn(`Channel ${embedData.channelId} not found, removing embed from database`);
            await mongo.removeLiveEmbed(embedData.messageId);
            return;
        }

        const message = await channel.messages.fetch(embedData.messageId);
        if (!message) {
            console.warn(`Message ${embedData.messageId} not found, removing embed from database`);
            await mongo.removeLiveEmbed(embedData.messageId);
            return;
        }

        // Generate updated embed
        const updatedEmbed = generateServerEmbed(serverList, shardList);
        
        // Update the message
        await message.edit({ embeds: [updatedEmbed] });
        
        // Update the hash in database
        await mongo.updateLiveEmbedHash(embedData.messageId, newHash);
        
        console.log(`Updated live embed ${embedData.messageId}`);
        
    } catch (error) {
        if (error.code === 10008 || error.code === 10003) {
            // Message or channel not found
            console.warn(`Message/Channel not found, removing embed ${embedData.messageId} from database`);
            await mongo.removeLiveEmbed(embedData.messageId);
        } else if (error.code === 50013) {
            // Missing permissions
            console.warn(`Missing permissions to update embed ${embedData.messageId}`);
        } else {
            console.error(`Error updating live embed ${embedData.messageId}:`, error);
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
            var statusEmoji = "🔴";

            if (shardList.some(obj => obj.name === s.name)) {
                onlineCount++;
                statusEmoji = "🟢";
            }

            if (s.tag == "PLUS") statusEmoji = "";
            if (!excludedTags.includes(s.tag) && !s.early_access) {
                str += `- **${s.tag.toUpperCase()} | ${s.name}** ${statusEmoji}\n ${s.tag.toLowerCase()}.valhallamc.io *(v.${s.modpack_version})*\n`;
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
        servers: serverList.map(server => ({
            tag: server.tag,
            name: server.name,
            modpack_version: server.modpack_version,
            server_version: server.server_version,
            excludeFromServerList: server.excludeFromServerList,
            early_access: server.early_access
        })),
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