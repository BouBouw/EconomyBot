const { ActivityType } = require('discord.js');
// const Group = require('../../../handlers/functions/Games/Groups/Group');

module.exports = {
    name: 'ready',
    once: false,
    execute: async (client, connection) => {
        console.log('[API] '.bold.green + `Connected to Discord.`.bold.white)

        client.user.setPresence({
            activities: [
                {
                    name: "Discord Bot Template",
                    type: ActivityType.Watching
                }
            ],
            status: "online"
        })

        // setInterval(Group.cleanPendingGroups, 3600000);

    }
}