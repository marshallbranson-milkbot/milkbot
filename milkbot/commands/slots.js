const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const cooldownsPath = path.join(__dirname, '../data/cooldowns.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const COST = 10;
const COOLDOWN = 30 * 1000; // 30 seconds

const SYMBOLS = [
  { emoji: '🥛', weight: 50 },  // Common
  { emoji: '🎲', weight: 25 },  // Uncommon
  { emoji: '🔥', weight: 12 },  // Rare
  { emoji: '💎', weight: 8 },   // Epic
  { emoji: '👑', weight: 5 },   // Ultra rare
];

const PAYOUTS = {
  '🥛': 50,
  '🎲': 150,
  '🔥': 350,
  '💎': 750,
  '👑': 1500,
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
    const now = Date.now();

    const cooldowns = getData(cooldownsPath);
    const lastSpin = cooldowns[`slots_${userId}`] || 0;
    const timeLeft = COOLDOWN - (now - lastSpin);

    if (timeLeft > 0) {
      const seconds = Math.ceil(timeLeft / 1000);
      return message.reply(`Slow down. Try again in **${seconds}s**. 🥛`);
    }

    const balances = getData(balancesPath);
    const balance = balances[userId] || 0;

    if (balance < COST) {
      return message.reply(`You need at least **${COST} milk bucks** to spin. You've got **${balance}**. 🥛`);
    }

    const reels = spin();
    const [a, b, c] = reels;

    balances[userId] = balance - COST;
    cooldowns[`slots_${userId}`] = now;

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
      winnings = 10;
      resultLine = `Two of a kind. You win **${winnings} milk bucks** back. Take it. 🥛`;
    } else {
      resultLine = `Nothing. The house ate your milk bucks. Better luck next time. 🥛`;
    }

    balances[userId] = (balances[userId] || 0) + winnings;
    saveData(balancesPath, balances);
    saveData(cooldownsPath, cooldowns);

    let xpGain = 0;
    if (a === b && b === c) {
      xpGain = a === '👑' ? 100 : a === '🥛' ? 15 : 30;
    } else if (a === b || b === c || a === c) {
      xpGain = 5;
    }
    if (xpGain > 0) {
      const xp = getData(xpPath);
      xp[userId] = (xp[userId] || 0) + (xpGain * (state.doubleXp ? 2 : 1));
      saveData(xpPath, xp);
    }

    const net = winnings - COST;
    const netStr = net >= 0 ? `+${net}` : `${net}`;
    const isJackpot = a === b && b === c && a === '👑';

    // Send spinning message then edit with result after delay
    const spinMsg = await message.reply(`🎰 | ⬛ ⬛ ⬛ | 🎰\n*Spinning...*`);

    setTimeout(() => {
      if (isJackpot) {
        spinMsg.edit(
          `🎰 | ${a} ${b} ${c} | 🎰\n` +
          resultLine
        );
        message.channel.send(`🚨 <@${userId}> HIT THE JACKPOT 🚨`);
      } else {
        spinMsg.edit(
          `🎰 | ${a} ${b} ${c} | 🎰\n` +
          `${resultLine}\n` +
          `*(net: ${netStr} milk bucks)*`
        );
      }
    }, 2000);
  }
};
