const curseforge = require("./curseforge");
const functions = require("./functions");
const modpacksch = require("./modpacksch");
const mongo = require("./mongo");
const pterodactyl = require("./pterodactyl");




module.exports = {

    /**
     * Starts a scheduler that checks for modpack updates at a specified interval.
     * @param {number} interval Time in hours between update checks. Default is 6 hours.
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
    },

    /**
     * Starts a scheduler that has a chance to give players on the servers a random amount of cake.
     * @param {number} interval Time in minutes between cake drops. Default is 120 minutes.
     * @param {number} min Minimum amount of cake to drop. Default is 1.
     * @param {number} max Maximum amount of cake to drop. Default is 10.
     * @param {number} chance One in x chance of dropping cake. Default is 3.
     */
    cakeDrop: async function (interval = 120, min = 1, max = 10, chance = 3) {
        console.log("Starting cake drop scheduler...");

        async function dropCake() {

            const randomNumber = Math.random();

            if (randomNumber < 1 / chance) {
                console.log("Dropping cake...");

                let cakeAmount = Math.floor(Math.random() * (max - min + 1)) + min;

                let servers = await mongo.getServers();


                for (let server of servers) {
                    await pterodactyl.sendCommand(server.serverId, `say Cake drop!`);

                    for (let i = 0; i < cakeAmount; i++) {
                        await pterodactyl.sendCommand(server.serverId, `give @a minecraft:cake 1`);
                        await functions.sleep(200);
                    }
                }
                console.log(`Dropped ${cakeAmount} cakes!`);
            }
        }

        //dropCake();
        setInterval(dropCake, interval * 60 * 1000);
    }
};