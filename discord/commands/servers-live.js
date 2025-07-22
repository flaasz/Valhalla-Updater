const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const mongo = require('../../modules/mongo');
const { sleep } = require('../../modules/functions');
const crypto = require('crypto');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servers-live')
        .setDescription('Creates an auto-updating server status embed (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // Double-check permissions
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ You need Administrator permissions to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const serverList = await mongo.getServers();
            await sleep(10);
            const shardList = await mongo.getShards();

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

                    if (shardList.some(obj => obj.name === s.name)) {
                        onlineCount++;
                        statusEmoji = "<:u:1389899745866027090>";
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

            // Send the embed
            const message = await interaction.editReply({
                embeds: [embed]
            });

            // Generate hash for change detection
            const serverStateHash = generateServerStateHash(serverList, shardList);

            // Store the live embed in database
            await mongo.storeLiveEmbed(
                message.id,
                interaction.channel.id,
                interaction.guild.id,
                interaction.user.id,
                serverStateHash
            );

            console.log(`Live embed created: ${message.id} by ${interaction.user.tag}`);

        } catch (error) {
            console.error('Error creating live embed:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Error')
                .setDescription('Failed to create live server status embed. Please try again.')
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};

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