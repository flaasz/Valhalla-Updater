const dircompare = require('dir-compare');

const options = {
    compareContent: true,
    comparesize: true,
    excludeFilter: ""
};
// Multiple compare strategy can be used simultaneously - compareSize, compareContent, compareDate, compareSymlink.
// If one comparison fails for a pair of files, they are considered distinct.


module.exports = {
    compare: async function (a, b) {
        const res = await dircompare.compareSync(a, b, options);

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

    findCustomChanges: async function (a, b) {
        const res = await dircompare.compareSync(a, b, options);

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
    }
};

function print(result) {
    console.log('Directories are %s', result.same ? 'identical' : 'different');

    console.log('Statistics - equal entries: %s, distinct entries: %s, left only entries: %s, right only entries: %s, differences: %s',
        result.equal, result.distinct, result.left, result.right, result.differences);

    //result.diffSet.forEach(dif => console.log('Difference - path: %s, name1: %s, type1: %s, name2: %s, type2: %s, state: %s',
    //dif.relativePath, dif.name1, dif.type1, dif.name2, dif.type2, dif.state));
}