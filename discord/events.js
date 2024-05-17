const fs = require('fs');
const path = require('path');

module.exports = {
    loadEventFiles: function (client) {
        const eventsPath = path.join(__dirname, 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
        
        let events = 0;
        for (const file of eventFiles) {
            events++;
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }

        console.log(`Loaded ${events} events!`); 
    }
};