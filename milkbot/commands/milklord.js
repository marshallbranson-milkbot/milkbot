const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { console.error('[getData] corrupted:', filePath); return {}; }
}

const GUILD_ID = '562076997979865118';
const MILK_LORD_ROLE_ID = '1491509290001764526';

function getMilkLordId(guild) {
  if (!guild) return null;
  const member = guild.members.cache.find(m => m.roles.cache.has(MILK_LORD_ROLE_ID));
  return member?.id || null;
}

function milkLordTag(userId, guild) {
  if (!guild || !userId) return '';
  return getMilkLordId(guild) === userId ? ' 👑 **MilkLord**' : '';
}

async function assignMilkLord(client) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);

    const balances = getData(balancesPath);
    if (Object.keys(balances).length === 0) return;

    const topUserId = Object.entries(balances).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const topMember = guild.members.cache.get(topUserId);
    if (!topMember) return;

    const role = guild.roles.cache.get(MILK_LORD_ROLE_ID);
    if (!role) return;

    const currentHolders = guild.members.cache.filter(m => m.roles.cache.has(MILK_LORD_ROLE_ID));
    for (const [, member] of currentHolders) {
      if (member.id !== topUserId) await member.roles.remove(role);
    }

    const channel = guild.channels.cache.find(c => c.name === 'milkbot-games' && c.isTextBased());

    if (!topMember.roles.cache.has(MILK_LORD_ROLE_ID)) {
      await topMember.roles.add(role);
      if (channel) {
        channel.send(
          `👑 **THE MILK LORD HAS BEEN CROWNED** 👑\n\n` +
          `**${topMember.user.username}** now reigns supreme with **${balances[topUserId].toLocaleString()} milk bucks**.\n` +
          `bow down. 🥛 all hail the 👑 **MilkLord**. their name will appear wherever they play.`
        );
      }
    } else {
      if (channel) {
        channel.send(
          `👑 **${topMember.user.username}** holds the **Milk Lord** title for another day with **${balances[topUserId].toLocaleString()} milk bucks**. the crown stays. 🥛`
        );
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
  getMilkLordId,
  milkLordTag,
  execute(message) {
    const balances = getData(balancesPath);
    if (Object.keys(balances).length === 0) {
      return message.reply('Nobody has any milk bucks yet. 🥛');
    }

    const topUserId = Object.entries(balances).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const topBalance = balances[topUserId];

    message.channel.send(`👑 The current **Milk Lord** is <@${topUserId}> 👑 **MilkLord** with **${topBalance.toLocaleString()} milk bucks**. bow down. 🥛`);
  }
};
