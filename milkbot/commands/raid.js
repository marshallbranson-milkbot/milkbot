const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');
const ws = require('../winstreak');
const ach = require('../achievements');
const jackpot = require('../jackpot');
const prestige = require('../prestige');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const JOIN_WINDOW = 15000;

// odds by crew size
function getOdds(size) {
  if (size >= 4) return 0.75;
  if (size === 3) return 0.65;
  if (size === 2) return 0.52;
  return 0.35;
}

// payout multiplier by crew size
function getMultiplier(size) {
  if (size >= 4) return 2.75;
  if (size === 3) return 2.25;
  if (size === 2) return 2.0;
  return 1.75;
}

// XP by crew size
function getXp(size) {
  if (size >= 4) return 120;
  if (size === 3) return 80;
  if (size === 2) return 60;
  return 40;
}

let activeRaid = null;

module.exports = {
  name: 'ra',
  aliases: ['raid', 'j'],
  description: 'Start a raid. Usage: !ra amount',
  execute(message, args) {
    // --- JOIN ---
    if (message.content.startsWith('!j')) {
      if (!activeRaid) {
        return message.reply(`No raid is active right now. Start one with \`!ra amount\`. 🥛`);
      }

      if (activeRaid.crew.has(message.author.id)) {
        return message.reply(`You're already in the raid. 🥛`);
      }

      if (message.author.id === activeRaid.leaderId) {
        return message.reply(`You started the raid, you're already in. 🥛`);
      }

      const balances = getData(balancesPath);
      const balance = balances[message.author.id] || 0;

      if (balance < activeRaid.buyIn) {
        return message.reply(`You need **${activeRaid.buyIn} milk bucks** to join. You've got **${balance}**. 🥛`);
      }

      balances[message.author.id] = balance - activeRaid.buyIn;
      saveData(balancesPath, balances);

      activeRaid.crew.set(message.author.id, message.author.username);
      const crewSize = activeRaid.crew.size + 1; // +1 for leader
      const odds = Math.round(getOdds(crewSize) * 100);

      return message.channel.send(
        `🔫 **${message.author.username} joined the raid!** Crew size: **${crewSize}** — Success odds: **${odds}%** 🥛`
      );
    }

    // --- START RAID ---
    if (activeRaid) {
      return message.reply(`A raid is already in progress! Type \`!j\` to get in. 🥛`);
    }

    const buyIn = parseInt(args[0]);

    if (!buyIn || isNaN(buyIn) || buyIn <= 0) {
      return message.reply(`Set a buy-in amount. \`!ra amount\` 🥛`);
    }

    const balances = getData(balancesPath);
    const leaderBalance = balances[message.author.id] || 0;

    if (leaderBalance < buyIn) {
      return message.reply(`You need **${buyIn} milk bucks** to start this raid. You've got **${leaderBalance}**. 🥛`);
    }

    balances[message.author.id] = leaderBalance - buyIn;
    saveData(balancesPath, balances);

    const crew = new Map();
    crew.set(message.author.id, message.author.username);

    const timeout = setTimeout(() => {
      if (!activeRaid) return;

      const finalCrew = activeRaid.crew;
      const crewSize = finalCrew.size;
      const odds = getOdds(crewSize);
      const multiplier = getMultiplier(crewSize);
      const xpGain = getXp(crewSize);
      const success = Math.random() < odds;
      jackpot.addToJackpot(5);

      const balances = getData(balancesPath);
      const xp = getData(xpPath);

      const crewNames = [...finalCrew.values()].join(', ');

      if (success) {
        const payout = Math.floor(activeRaid.buyIn * multiplier);
        const baseXp = xpGain * (state.doubleXp ? 2 : 1);
        const hotAnnouncements = [];

        for (const [userId, username] of finalCrew) {
          const newStreak = ws.recordWin(userId);
          const hotMultiplier = newStreak >= 3 ? 1.5 : 1;
          const pm = prestige.getMultiplier(userId);
          balances[userId] = (balances[userId] || 0) + Math.floor(payout * hotMultiplier * pm);
          xp[userId] = (xp[userId] || 0) + Math.floor(baseXp * hotMultiplier * pm);
          if (newStreak >= 3) hotAnnouncements.push({ username, newStreak });
        }
        saveData(balancesPath, balances);
        saveData(xpPath, xp);

        message.channel.send(
          `🔫 **RAID SUCCESS!** 🔫\n` +
          `**Crew:** ${crewNames}\n` +
          `The job went clean. Everyone walks away with **${payout} milk bucks**. Milk money. 🥛\n` +
          `*(+${xpGain} XP each)*`
        );
        for (const { username, newStreak } of hotAnnouncements) ws.announceStreak(message.channel, username, newStreak);
        // One jackpot try for the raid leader
        jackpot.tryJackpot(activeRaid.leaderId, finalCrew.get(activeRaid.leaderId), message.channel);
        for (const [userId, username] of finalCrew) {
          ach.check(userId, username, 'raid_win', { balance: balances[userId], crewSize, gameType: 'raid' }, message.channel);
        }
      } else {
        const coldAnnouncements = [];
        for (const [userId, username] of finalCrew) {
          const prevStreak = ws.resetStreak(userId);
          if (prevStreak >= 3) coldAnnouncements.push(`❄️ **${username}'s hot streak is OVER** after ${prevStreak} wins. Back to normal. 🥛`);
        }
        saveData(balancesPath, balances);

        message.channel.send(
          `🚨 **RAID FAILED!** 🚨\n` +
          `**Crew:** ${crewNames}\n` +
          `You got cooked. MilkBot ate every last milk buck. Should've brought more crew. 🥛`
        );
        for (const msg of coldAnnouncements) message.channel.send(msg);
      }

      activeRaid = null;
    }, JOIN_WINDOW);

    activeRaid = { leaderId: message.author.id, buyIn, crew, timeout };

    message.channel.send(
      `🔫 **RAID STARTING** 🔫\n` +
      `${message.author.username} is launching a raid with a **${buyIn} milk buck** buy-in!\n\n` +
      `Type \`!j\` to get in. You have **15 seconds**. More crew = better odds + bigger payout. ⏳`
    );
  }
};
