const curseforge = require("./curseforge");
const modpacksch = require("./modpacksch");
const mongo = require("./mongo");
const {
    updateFTB
} = require("./updater");




module.exports = {

    /**
     * Starts a scheduler that checks for modpack updates at a specified interval.
     * @param {number} [interval] Time in hours between update checks. Default is 6 hours.
     */
    checkForUpdates: async function (interval = 6) {
        console.log("Starting update scheduler...");

        async function updateCheck() {
            console.log("Checking for updates...");

            let servers = await mongo.getServers();

            for (let server of servers) {
                let newestUpdateId = 0;
                let updateRequired = false;
                if (server.platform === "curseforge" || server.platform === "gregtechnewhorizons") {
                    newestUpdateId = await curseforge.getLatestVersionId(server.modpackID);
                }
                if (server.platform === "feedthebeast") {
                    newestUpdateId = await modpacksch.getLatestFTBVersionId(server.modpackID);
                }
                if (server.fileID === newestUpdateId) {
                    console.log(`No updates found for ${server.name}.`);
                } else {
                    console.log(`Update found for ${server.name}!`);
                    updateRequired = true;
                }

                let update = {
                    $set: {
                        newestFileID: newestUpdateId,
                        requiresUpdate: updateRequired
                    }
                };

                await mongo.updateServer(server.modpackID, update);
                //console.log(newestUpdateId);
            }
            await servers.forEach(async server => {

            });
        }

        updateCheck();
        setInterval(updateCheck, interval * 60 * 60 * 1000);
    }
};