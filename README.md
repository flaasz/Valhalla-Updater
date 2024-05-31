# Valhalla Updater

Valhalla Updater is a versatile tool designed to simplify the process of checking for updates and automatically updating CurseForge and FeedTheBeast modpacks, built with modularity in mind. It was designed to be used on ValhallaMC Network. You can find more information here: [ValhallaMC Discord](https://dc.valhallamc.io/)

## Features

- **Automatic Updates:** Valhalla Updater automates the process of checking for updates and applying them to your modpacks, saving you time and effort.
- **Backups before updating:** Files on the server are automatically backed up, so you can restore them manually after a failed update.
- **Advanced Comparator:** Two level comparison ensures that the changes you made to the server are intact, and if any of the custom files are overwritten, it will list them.
- **CurseForge and FeedTheBeast Support:** Whether you're using CurseForge or FeedTheBeast modpacks, Valhalla Updater has got you covered.
- **Modular Architecture:** The project is designed to be easily extensible, with plans to create adapters for various databases beyond the current support for MongoDB and Pterodactyl.
- **Discord Integration:** Interact with Valhalla Updater directly from Discord using intuitive commands.
- **Modular Schedulers:** Choose from a selection of modular schedulers to tailor the update process to your preferences.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your_username/valhalla-updater.git
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start it to generate config:

   ```bash
   npm start
   ```

4. Customize `.env`, `./config/config.json` and `./config/messages.json` with your configuration details.

**[!] Currently available are only MongoDB and Pterodactyl. Please make sure the servers collection in MongoDB follows this structure**

```js
{
    tag: 'ske', //short tag of the pack preferably from ip, ie. ske.valhallamc.io
    discord_role_id: '', //id of the role on discord, if empty roleAssigner scheduler will create a role and update this field
    name: 'FTB Skies Expert', //name of the pack
    modpack_version: '1.8.1', //current human-readable version of the modpack
    serverId: 'asdadas', //server id on pterodactyl, last part of the url of the server console
    modpackID: 117, //id of the modpack on cf or ftb
    fileID: 11927, //id of the current update file on cf or ftb
    newestFileID: 11927, //id of the newest update file, can be 0
    platform: 'feedthebeast', //accepts "curseforge" or "feedthebeast"
    requiresUpdate: false //leave it as false
}
```

## Usage

1. **Discord Commands:** Use the commands on Discord  to interact with Valhalla Updater:

    - `/update <modpack name>`: Update a specific modpack.
    - `/restore <modpack_name> <backup>`: Restore a specific modpack, in case something went wrong.

2. **Modular Schedulers:** After first start schedulers configs will appear in `./config/config.json`.

## Contributing

We welcome contributions from the community! Whether it's bug fixes, feature enhancements, or documentation improvements, feel free to submit a pull request.

## Roadmap

- **Adapter Support:** Expand database support beyond MongoDB and Pterodactyl.
- **Enhanced Discord Integration:** Implement additional Discord functionalities and commands.
- **More Modular Schedulers:** Introduce new schedulers to further customize the update process.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Feel free to reach out with any questions, feedback, or feature requests on [ValhallaMC Discord](https://dc.valhallamc.io/). Happy updating! 🚀
