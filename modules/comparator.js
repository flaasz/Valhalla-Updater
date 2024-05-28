/*
 * File: comparator.js
 * Project: Valhalla-Updater
 * File Created: Friday, 10th May 2024 7:42:12 pm
 * Author: flaasz
 * -----
 * Last Modified: Tuesday, 28th May 2024 2:11:42 am
 * Modified By: flaasz
 * -----
 * Copyright 2024 flaasz
 */

const dircompare = require('dir-compare');

const options = {
    compareContent: true,
    comparesize: true,
    excludeFilter: ""
};
// Multiple compare strategy can be used simultaneously - compareSize, compareContent, compareDate, compareSymlink.
// If one comparison fails for a pair of files, they are considered distinct.


module.exports = {
    /**
     * Compares two directories and returns a list of changes.
     * @param {string} firstDir Path to the first directory to compare.
     * @param {string} secondDir Path to the second directory to compare.
     * @returns Object containing lists of deletions and additions.
     */
    compare: async function (firstDir, secondDir) {
        const res = await dircompare.compareSync(firstDir, secondDir, options);

        let changeList = {
            deletions: [],
            additions: [],
        };
        res.diffSet.forEach(dif => {
            if (dif.state === "left") {
                console.log(`Difference - delete: ${dif.relativePath}, name1: ${dif.name1}, type1: ${dif.type1}, state: ${dif.state}`);
                changeList.deletions.push(dif.relativePath + "\\" + dif.name1);
            } else if (dif.state === "right") {
                console.log(`Difference - add: ${dif.relativePath}, name2: ${dif.name2}, type2: ${dif.type2}, state: ${dif.state}`);
                changeList.additions.push(dif.relativePath + "\\" + dif.name2);
            } else if (dif.state === "equal") {} else {
                console.log(`Difference - replace: ${dif.relativePath}, name1: ${dif.name1}, type1: ${dif.type1}, name2: ${dif.name2}, type2: ${dif.type2}, state: ${dif.state}`);
                changeList.deletions.push(dif.relativePath + "\\" + dif.name1);
                changeList.additions.push(dif.relativePath + "\\" + dif.name2);
            }

        });

        print(res);
        //console.log(changeList);
        return changeList;
    },

    /**
     * Finds the custom changes between two directories.
     * @param {string} customDir Path to customised directory.
     * @param {string} originalDir Path to original directory.
     * @returns Object containing lists of custom files, missing files, and edited files.
     */
    findCustomChanges: async function (customDir, originalDir) {
        const res = await dircompare.compareSync(customDir, originalDir, options);

        let customChanges = {
            customFiles: [],
            missingFiles: [],
            editedFiles: []
        };
        res.diffSet.forEach(dif => {
            if (dif.state === "left") {
                console.log(`Custom file: ${dif.relativePath}, name1: ${dif.name1}, type1: ${dif.type1}, state: ${dif.state}`);
                customChanges.customFiles.push(dif.relativePath + "\\" + dif.name1);
            } else if (dif.state === "right") {
                console.log(`Missing file: ${dif.relativePath}, name2: ${dif.name2}, type2: ${dif.type2}, state: ${dif.state}`);
                customChanges.missingFiles.push(dif.relativePath + "\\" + dif.name2);
            } else if (dif.state === "equal") {} else {
                console.log(`Custom file - edited: ${dif.relativePath}, name1: ${dif.name1}, type1: ${dif.type1}, name2: ${dif.name2}, type2: ${dif.type2}, state: ${dif.state}`);
                customChanges.editedFiles.push(dif.relativePath + "\\" + dif.name2);
            }

        });

        print(res);
        //console.log(changeList);
        return customChanges;
    },

    /**
     * Finds custom changes between two manifest files.
     * @param {Array} customManifest Manifest with custom changes.
     * @param {Array} originalManifest Manifest with original changes.
     * @returns Object containing lists of custom files, missing files, and edited files.
     */
    findCustomManifestChanges: async function (customManifest, originalManifest) {
        let customChanges = {
            customFiles: [],
            missingFiles: [],
            editedFiles: []
        };

        let changelog = await this.compareManifest(customManifest, originalManifest);

        changelog.leftOnly.forEach(dif => {
            console.log(`Custom file: ${dif.path}, name1: ${dif.name}`);
            customChanges.customFiles.push(dif.path + dif.name);
        });

        changelog.rightOnly.forEach(dif => {
            console.log(`Missing file: ${dif.path}, name2: ${dif.name}`);
            customChanges.missingFiles.push(dif.path + dif.name);
        });

        changelog.different.forEach(dif => {
            console.log(`Custom file - edited: ${dif.left.path}, name1: ${dif.left.name}, name2: ${dif.right.name}`);
            customChanges.editedFiles.push(dif.left.path + dif.left.name);
        });
        console.log(customChanges);
        return customChanges;
    },

    /**
     * Compare two manifest files and return the differences.
     * @param {Array} leftManifest First manifest to compare.
     * @param {Array} rightManifest Second manifest to compare.
     * @returns Object containing lists of matching, left only, right only, and different files.
     */
    compareManifest: async function (leftManifest, rightManifest) {
        let result = {
            matching: [],
            leftOnly: [],
            rightOnly: [],
            different: []
        };

        let leftMap = new Map();
        let rightMap = new Map();

        leftManifest.forEach(item => {
            const key = `${item.path}:${item.name}`;
            leftMap.set(key, item);
        });

        rightManifest.forEach(item => {
            const key = `${item.path}:${item.name}`;
            rightMap.set(key, item);
        });

        leftMap.forEach((leftItem, key) => {
            if (rightMap.has(key)) {
                const rightItem = rightMap.get(key);
                if (leftItem.sha1 === rightItem.sha1 && leftItem.size === rightItem.size) {
                    result.matching.push(leftItem);
                } else {
                    result.different.push({
                        left: leftItem,
                        right: rightItem
                    });
                }
                rightMap.delete(key);
            } else {
                result.leftOnly.push(leftItem);
            }
        });

        rightMap.forEach(rightItem => {
            result.rightOnly.push(rightItem);
        });

        return result;
    }

};

/**
 * Parses the result of the comparison and prints it to the console.
 * @param {object} result Result of the comparison.
 */
function print(result) {
    console.log('Directories are %s', result.same ? 'identical' : 'different');

    console.log('Statistics - equal entries: %s, distinct entries: %s, left only entries: %s, right only entries: %s, differences: %s',
        result.equal, result.distinct, result.left, result.right, result.differences);

    //result.diffSet.forEach(dif => console.log('Difference - path: %s, name1: %s, type1: %s, name2: %s, type2: %s, state: %s',
    //dif.relativePath, dif.name1, dif.type1, dif.name2, dif.type2, dif.state));
}