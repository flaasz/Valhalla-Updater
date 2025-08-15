/*
 * File: tabConfigGen.js
 * Project: valhalla-updater
 * File Created: Monday, 20th May 2024 11:54:16 pm
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 15th June 2024 1:58:55 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const {
    getServers
} = require("./mongo");

module.exports = {
    generateTabConfig: async function () {
        const serverList = await getServers();
        const content = await this.generateTabConfigContent();
        console.log(content);
    },

    generateTabConfigContent: async function () {
        const serverList = await getServers();

        let tagResult = "";
        let nameResult = "";

        let longestTag = getLongestTag(serverList);

        for (let i = 0; i < serverList.length-1; i++) {
            tagResult += `  tag${i}:\n    conditions:\n      - "%server%=${serverList[i].name}"\n    yes: "${padTags(serverList[i], longestTag)}"\n    no: "%condition:tag${i + 1}%"\n`;
            nameResult += `  smallCaps${i}:\n    conditions:\n      - "%server%=${serverList[i].name}"\n    yes: "${toSmallCaps(serverList[i].name)}"\n    no: "%condition:smallCaps${i + 1}%"\n`;
        }
        tagResult += `  tag${serverList.length-1}:\n    conditions:\n      - "%server%=${serverList[serverList.length-1].name}"\n    yes: "${padTags(serverList[serverList.length-1], longestTag)}"\n    no: "[???]"\n`;
        nameResult += `  smallCaps${serverList.length-1}:\n    conditions:\n      - "%server%=${serverList[serverList.length-1].name}"\n    yes: "${toSmallCaps(serverList[serverList.length-1].name)}"\n    no: "???"\n`;

        return tagResult + nameResult;
    },

    generateServerHash: async function () {
        const crypto = require('crypto');
        const serverList = await getServers();
        
        // Create a consistent hash of server data that affects tab config
        const serverData = serverList.map(server => ({
            name: server.name,
            tag: server.tag,
            color: server.color
        })).sort((a, b) => a.name.localeCompare(b.name)); // Sort for consistency
        
        const dataString = JSON.stringify(serverData);
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }
};

// module.exports.generateTabConfig();
/*

  serverName:
    conditions:
      - "%server%=DEVASLPPANA"
    yes: "&8[DEV&8]"
    no: "%condition:serverName2%"


*/
function getLongestTag(serverList) {
    let longestTag = 0;
    for (let server of serverList) {
        if (server.tag.length > longestTag) {
            longestTag = server.tag.length;
        }
    }
    return longestTag;
}

function padTags(server, maxLength) {
    let padding = maxLength - server.tag.length;
    if(padding!=0) padding++;
    let space = " ";

    return `&8[${getColorCode(server.color)}${server.tag.toUpperCase()}&8]&r`;      //${space.repeat(padding)}&r`;
}

function toSmallCaps(input) {
    const smallCapsMap = {
        'a': 'ᴀ',
        'b': 'ʙ',
        'c': 'ᴄ',
        'd': 'ᴅ',
        'e': 'ᴇ',
        'f': 'ғ',
        'g': 'ɢ',
        'h': 'ʜ',
        'i': 'ɪ',
        'j': 'ᴊ',
        'k': 'ᴋ',
        'l': 'ʟ',
        'm': 'ᴍ',
        'n': 'ɴ',
        'o': 'ᴏ',
        'p': 'ᴘ',
        'q': 'ǫ',
        'r': 'ʀ',
        's': 'ꜱ',
        't': 'ᴛ',
        'u': 'ᴜ',
        'v': 'ᴠ',
        'w': 'ᴡ',
        'x': 'x',
        'y': 'ʏ',
        'z': 'ᴢ'
    };

    let result = '';
    for (let char of input) {
        if (smallCapsMap[char.toLowerCase()]) {
            result += smallCapsMap[char.toLowerCase()];
        } else {
            result += char;
        }
    }
    return result;
}

function getColorCode(color) {
    const colorCodes = {
        black: '&0',
        dark_blue: '&1',
        dark_green: '&2',
        cyan: '&3',
        dark_red: '&4',
        dark_purple: '&5',
        gold: '&6',
        gray: '&7',
        dark_gray: '&8',
        blue: '&9',
        green: '&a',
        aqua: '&b',
        red: '&c',
        light_purple: '&d',
        yellow: '&e',
        white: '&f'
    };

    const code = colorCodes[color.toLowerCase()];
    if (code) {
        return code;
    } else {
        throw new Error('Invalid color name');
    }
}