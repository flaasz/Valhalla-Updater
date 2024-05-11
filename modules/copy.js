const copydir = require('copy-dir');


module.exports = {
    copyDir: async function(a, b, options = {}) {
        copydir(a, b, options);
    }
};