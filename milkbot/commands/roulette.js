const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath       = path.join(__dirname, '../data/xp.json');
const state    = require('../state');
const ws       = require('../winstreak');
const ach      = require('../achievements');
const jackpot  = require('../jackpot');
const prestige = require('../prestige');

const MIN_BET  = 10;
const XP_WIN   = 30;
const XP_LOSS  = 5;

// Standard European roulette color layout
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getData(p) {
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error('[getData] corrupted:', p); return {}; }
}
function saveData(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

function getColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

function colorEmoji(c) {
  return c === 'red' ? '🔴' : c === 'black' ? '⚫' : '🟢';
}

function parseBet(arg) {
  if (!arg) return null;
  const lower = arg.toLowerCase();
  if (lower === 'red' || lower === 'black') return { type: lower };
  const n = parseInt(arg, 10);
  if (!isNaN(n) && n >= 0 && n <= 36) return { type: 'number', value: n };
  return null;
}

module.exports = {
  name: 'rou',
  aliases: ['roulette'],
  description: 'Spin the roulette wheel. Colors pay 2x, numbers pay 35x.',
  async execute(message, args) {
    const amount = parseInt(args[0], 10);
    if (!amount || amount < MIN_BET) {
      return message.reply(`minimum bet is **${MIN_BET} milk bucks**. \`!rou <amount> <red|black|0-36>\` 🥛`);
    }

    const bet = parseBet(args[1]);
    if (!bet) {
      return message.reply(`pick a color or number. \`!rou <amount> <red|black|0-36>\` 🥛`);
    }

    const userId   = message.author.id;
    const username = message.author.username;
    const balances = getData(balancesPath);
    const balance  = balances[userId] || 0;

    if (balance < amount) {
      return message.reply(`you only have **${balance} milk bucks**. can't bet what you don't have. 🥛`);
    }

    // Deduct immediately
    balances[userId] = balance - amount;
    saveData(balancesPath, balances);

    jackpot.addToJackpot(Math.floor(amount * 0.02));

    // Spinning embed
    const spinEmbed = new EmbedBuilder()
      .setTitle('🎡  ROULETTE  🎡')
      .setDescription(`**${username}** bet **${amount} milk bucks** on **${args[1].toLowerCase()}**\n\n*the wheel is spinning...*`)
      .setColor(0xffcc00);

    const msg = await message.channel.send({ embeds: [spinEmbed] });

    // Spin result
    const result = Math.floor(Math.random() * 37); // 0–36
    const resultColor = getColor(result);
    const resultEmoji = colorEmoji(resultColor);

    // Determine win
    let won = false;
    let payout = 0;
    if (bet.type === 'red' || bet.type === 'black') {
      won = (bet.type === resultColor);
      payout = won ? amount * 2 : 0;
    } else {
      won = (result === bet.value);
      payout = won ? amount * 35 : 0;
    }

    const newStreak = won ? ws.recordWin(userId) : (ws.resetStreak(userId), 0);
    const hotMul  = (won && newStreak >= 3) ? 1.5 : 1;
    const pm      = prestige.getMultiplier(userId);
    const finalPayout = won ? Math.floor(payout * hotMul * pm) : 0;
    const xpGain  = won
      ? Math.floor(XP_WIN * (state.doubleXp ? 2 : 1) * hotMul * pm)
      : XP_LOSS;

    if (won) {
      balances[userId] = Math.min(10_000_000, (balances[userId] || 0) + finalPayout);
      saveData(balancesPath, balances);
    }

    const xp = getData(xpPath);
    const cappedXp = won ? Math.min(200, xpGain) : xpGain;
    xp[userId] = Math.min(require('../prestige').getXpCap(userId), (xp[userId] || 0) + cappedXp);
    saveData(xpPath, xp);

    // Result embed
    const bonuses = [hotMul > 1 ? '🔥 1.5x streak' : '', pm > 1 ? `🌟 ${pm}x prestige` : ''].filter(Boolean).join(' · ');

    let desc;
    if (won) {
      desc = `${resultEmoji} **${result}** — ${resultColor.toUpperCase()}\n\n✅ **${username}** wins **${finalPayout} milk bucks**!${bonuses ? ` *(${bonuses})*` : ''} 🥛`;
    } else {
      desc = `${resultEmoji} **${result}** — ${resultColor.toUpperCase()}\n\n❌ not your number. **${amount} milk bucks** gone. 🥛`;
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle('🎡  ROULETTE  🎡')
      .setDescription(desc)
      .setColor(won ? 0x44ff88 : 0xff4444);

    await msg.edit({ embeds: [resultEmbed] });

    if (won) {
      if (newStreak >= 3) ws.announceStreak(message.channel, username, newStreak);
      jackpot.tryJackpot(userId, username, message.channel);
      ach.check(userId, username, 'game_win', { balance: balances[userId], xp: xp[userId], streak: newStreak, gameType: 'roulette' }, message.channel);
    } else {
      ach.check(userId, username, 'game_loss', { balance: balances[userId], xp: xp[userId], streak: 0, gameType: 'roulette' }, message.channel);
    }
  },
};
