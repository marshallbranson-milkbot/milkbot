const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');
const ws = require('../winstreak');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const COST = 10;

const SYMBOLS = [
  { emoji: '🥛', weight: 50 },  // Common
  { emoji: '🎲', weight: 25 },  // Uncommon
  { emoji: '🔥', weight: 12 },  // Rare
  { emoji: '💎', weight: 8 },   // Epic
  { emoji: '👑', weight: 5 },   // Ultra rare
];

const PAYOUTS = {
  '🥛': 75,
  '🎲': 225,
  '🔥': 525,
  '💎': 1125,
  '👑': 2250,
};

function spin() {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  return Array.from({ length: 3 }, () => {
    let roll = Math.random() * totalWeight;
    for (const symbol of SYMBOLS) {
      roll -= symbol.weight;
      if (roll <= 0) return symbol.emoji;
    }
    return SYMBOLS[0].emoji;
  });
}

module.exports = {
  name: 'sl',
  aliases: ['slots'],
  description: 'Spin the slots for 10 milk bucks.',
  async execute(message) {
    const userId = message.author.id;

    const balances = getData(balancesPath);
    const balance = balances[userId] || 0;

    if (balance < COST) {
      return message.reply(`You need at least **${COST} milk bucks** to spin. You've got **${balance}**. 🥛`);
    }

    const reels = spin();
    const [a, b, c] = reels;

    balances[userId] = balance - COST;

    let winnings = 0;
    let resultLine = '';

    if (a === b && b === c) {
      winnings = PAYOUTS[a];
      if (a === '👑') {
        resultLine = `👑 **JACKPOT!!!** 👑\n**${message.author.username} just hit triple crowns for ${winnings} milk bucks!!!** The server bows down. 🥛`;
      } else {
        resultLine = `**Three of a kind!** You win **${winnings} milk bucks**! 🥛`;
      }
    } else if (a === b || b === c || a === c) {
      winnings = 15;
      resultLine = `Two of a kind. You win **${winnings} milk bucks** back. Take it. 🥛`;
    } else {
      resultLine = `Nothing. The house ate your milk bucks. Better luck next time. 🥛`;
    }

    // Hot streak + win streak logic
    let streakAnnouncement = null;
    let multiplier = 1;
    if (winnings > 0) {
      const newStreak = ws.recordWin(userId);
      multiplier = newStreak >= 3 ? 1.5 : 1;
      if (newStreak === 3) streakAnnouncement = `🔥 **${message.author.username} is on a HOT STREAK!** 3 wins in a row — 1.5x on everything! 🥛`;
    } else {
      const prevStreak = ws.resetStreak(userId);
      if (prevStreak >= 3) streakAnnouncement = `❄️ **${message.author.username}'s hot streak is OVER** after ${prevStreak} wins. Back to normal. 🥛`;
    }

    const actualWinnings = Math.floor(winnings * multiplier);
    balances[userId] = (balances[userId] || 0) + actualWinnings;
    saveData(balancesPath, balances);

    let xpGain = 0;
    if (a === b && b === c) {
      xpGain = a === '👑' ? 100 : a === '🥛' ? 15 : 30;
    } else if (a === b || b === c || a === c) {
      xpGain = 5;
    }
    if (xpGain > 0) {
      const xp = getData(xpPath);
      xp[userId] = (xp[userId] || 0) + Math.floor(xpGain * (state.doubleXp ? 2 : 1) * multiplier);
      saveData(xpPath, xp);
    }

    const net = actualWinnings - COST;
    const netStr = net >= 0 ? `+${net}` : `${net}`;
    const isJackpot = a === b && b === c && a === '👑';

    // Send spinning message then edit with result after delay
    const spinMsg = await message.reply(`🎰 | ⬛ ⬛ ⬛ | 🎰\n*Spinning...*`);

    setTimeout(() => {
      if (isJackpot) {
        spinMsg.edit(`🎰 | ${a} ${b} ${c} | 🎰\n` + resultLine);
        message.channel.send(`🚨 <@${userId}> HIT THE JACKPOT 🚨`);
      } else {
        spinMsg.edit(
          `🎰 | ${a} ${b} ${c} | 🎰\n` +
          `${resultLine}\n` +
          `*(net: ${netStr} milk bucks${multiplier > 1 ? ' — 🔥 1.5x hot streak' : ''})*`
        );
      }
      if (streakAnnouncement) message.channel.send(streakAnnouncement);
    }, 2000);
  }
};
