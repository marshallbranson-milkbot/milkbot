const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');

  function getData(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  const GUILD_ID = '562076997979865118';
  const MILK_LORD_ROLE_ID = '1491509290001764526';

  async function assignMilkLord(client) {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      await guild.members.fetch();

      const balances = getData(balancesPath);

      if (Object.keys(balances).length === 0) return;

      // Find the user with the most milk bucks
      const topUserId = Object.entries(balances).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      const topMember = guild.members.cache.get(topUserId);

      if (!topMember) return;

      const role = guild.roles.cache.get(MILK_LORD_ROLE_ID);
      if (!role) return;

      // Remove role from anyone who currently has it
      const currentHolders = guild.members.cache.filter(m => m.roles.cache.has(MILK_LORD_ROLE_ID));
      for (const [, member] of currentHolders) {
        if (member.id !== topUserId) {
          await member.roles.remove(role);
        }
      }

      // Give role to the top user
      if (!topMember.roles.cache.has(MILK_LORD_ROLE_ID)) {
        await topMember.roles.add(role);
        const channel = guild.channels.cache.find(c => c.name === 'bot-games' && c.isTextBased());
        if (channel) {
          channel.send(`👑 **${topMember.user.username}** is the new **Milk Lord** with **${balances[topUserId]} milk
  bucks**! bow down. 🥛`);
        }
      }
    } catch (err) {
      console.error('Milk Lord error:', err);
    }
  }

  module.exports = {
    name: 'milklord',
    description: 'Shows the current Milk Lord.',
    assignMilkLord,
    execute(message) {
      const balances = getData(balancesPath);
      if (Object.keys(balances).length === 0) {
        return message.reply('Nobody has any milk bucks yet. 🥛');
      }

      const topUserId = Object.entries(balances).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      const topBalance = balances[topUserId];

      message.channel.send(`👑 The current **Milk Lord** has **${topBalance} milk bucks**. <@${topUserId}> is running
  the show. 🥛`);
    }
  };