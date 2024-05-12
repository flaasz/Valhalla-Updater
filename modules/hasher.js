const fs = require('fs');
const crypto = require('crypto');

module.exports = {
    hashFile: function (filePath) {
        const file = fs.readFileSync(filePath);
        let hash = crypto.createHash('sha1').update(file).digest('hex');
        return hash;
    }
};