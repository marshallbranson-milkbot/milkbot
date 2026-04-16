const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');
const ws = require('../winstreak');
const ach = require('../achievements');
const jackpot = require('../jackpot');
const { milkLordTag } = require('./milklord');

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

const activeSpins = new Set();

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

    if (activeSpins.has(userId)) {
      return message.reply(`Your reels are still spinning! Wait for the result. 🎰`);
    }

    const balances = getData(balancesPath);
    const balance = balances[userId] || 0;

    if (balance < COST) {
      return message.reply(`You need at least **${COST} milk bucks** to spin. You've got **${balance}**. 🥛`);
    }

    const reels = spin();
    const [a, b, c] = reels;

    balances[userId] = balance - COST;
    jackpot.addToJackpot(10);

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
    let hotStreak = 0;
    let coldStreakMsg = null;
    let multiplier = 1;
    if (winnings > 0) {
      const newStreak = ws.recordWin(userId);
      multiplier = newStreak >= 3 ? 1.5 : 1;
      hotStreak = newStreak;
    } else {
      const prevStreak = ws.resetStreak(userId);
      if (prevStreak >= 3) coldStreakMsg = `❄️ **${message.author.username}'s hot streak is OVER** after ${prevStreak} wins. Back to normal. 🥛`;
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
      const gain = Math.min(200, Math.floor(xpGain * (state.doubleXp ? 2 : 1) * multiplier));
      xp[userId] = Math.min(require('../prestige').getXpCap(userId), (xp[userId] || 0) + gain);
      saveData(xpPath, xp);
    }

    const net = actualWinnings - COST;
    const netStr = net >= 0 ? `+${net}` : `${net}`;
    const isJackpot = a === b && b === c && a === '👑';

    // Send spinning message then edit with result after delay
    activeSpins.add(userId);
    const spinMsg = await message.reply(`🎰 | ⬛ ⬛ ⬛ | 🎰\n*Spinning...*`);

    setTimeout(() => {
      activeSpins.delete(userId);
      const lordTag = milkLordTag(userId, message.guild);
      if (isJackpot) {
        spinMsg.edit(`🎰 | ${a} ${b} ${c} | 🎰\n` + resultLine);
        message.channel.send(`🚨 <@${userId}>${lordTag} **HIT THE JACKPOT** 🚨`);
      } else {
        spinMsg.edit(
          `🎰 | ${a} ${b} ${c} | 🎰\n` +
          (lordTag && winnings > 0 ? `👑 **MilkLord** spins...\n` : '') +
          `${resultLine}\n` +
          `*(net: ${netStr} milk bucks${multiplier > 1 ? ' — 🔥 1.5x hot streak' : ''})*`
        );
      }
      if (hotStreak >= 3) ws.announceStreak(message.channel, message.author.username, hotStreak);
      if (coldStreakMsg) message.channel.send(coldStreakMsg);
      ach.check(userId, message.author.username, 'slot_spin', {}, message.channel);
      if (winnings > 0) {
        jackpot.tryJackpot(userId, message.author.username, message.channel);
        const isJackpotWin = a === b && b === c && a === '👑';
        ach.check(userId, message.author.username, isJackpotWin ? 'slots_jackpot' : 'game_win', { balance: balances[userId], streak: ws.getStreak(userId), gameType: 'slots' }, message.channel);
      } else {
        ach.check(userId, message.author.username, 'game_loss', { gameType: 'slots', balance: balances[userId] }, message.channel);
      }
    }, 2000);
  }
};
