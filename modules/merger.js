/*
 * File: merger.js
 * Project: Valhalla-Updater
 * File Created: Friday, 10th May 2024 10:43:43 pm
 * Author: flaasz
 * -----
 * Last Modified: Saturday, 25th May 2024 4:06:27 pm
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

var fs = require('fs');

module.exports = {
    /**
     * Merges the changes from the changeList to the temp directory.
     * @param {String} dir Work directory to merge changes to.
     * @param {Object} changeList ChangeList object containing the changes.
     */
    merge: function (dir, changeList) {
        for (let path of changeList.deletions) {
            if (fs.existsSync(`${dir}/compare/main${path}`)) {
                fs.rmSync(`${dir}/compare/main${path}`, {
                    recursive: true,
                    force: true
                });
            }
        }
        console.log("Removed old files");
        for (let path of changeList.additions) {
            fs.cpSync(`${dir}/compare/new${path}`, `${dir}/compare/main${path}`, {
                recursive: true
            });
            //fs.copyFileSync(`./compare/new${path}`, `./temp${path}`);
        }
        console.log("Added new files");
    },

    /**
     * Merges the changes from the changeList to the temp directory.
     * @param {string} dir The directory to merge the changes to.
     * @param {object} changeList Object containing the changes.
     * @param {object} customChanges Object containing the custom changes.
     */
    mergeFromManifest: function (dir, changeList, customChanges) {


        //this doesnt work yet!!!!!
        let customOverwrites = [];

        for (let path of changeList.left) {
            if (fs.existsSync(`${dir}${path}`)) {
                fs.rmSync(`${dir}${path}`, {
                    recursive: true,
                    force: true
                });
            }
        }
        console.log("Removed old files");
        for (let path of changeList.right) {
            fs.cpSync(`${dir}${path}`, `${dir}${path}`, {
                recursive: true
            });
        }
        console.log("Added new files");
    }
};