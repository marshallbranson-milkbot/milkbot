const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath       = path.join(__dirname, '../data/xp.json');
const state    = require('../state');
const ws       = require('../winstreak');
const prestige = require('../prestige');

const MIN_BET = 10;
const ROWS = 12;
const MULTIPLIERS = [10, 5, 3, 1.5, 0.8, 0.5, 0.3, 0.5, 0.8, 1.5, 3, 5, 10];
const MUL_LABELS  = ['10x','5x','3x','1.5x','0.8x','0.5x','0.3x','0.5x','0.8x','1.5x','3x','5x','10x'];
const XP_WIN = 30;
const XP_LOSS = 5;

function getData(p) {
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error('[getData] corrupted:', p); return {}; }
}
function saveData(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

function boardRow(ballPos) {
  return Array.from({ length: 13 }, (_, i) => i === ballPos ? '🟡' : '⬛').join('');
}

function prizeRow(winnerSlot) {
  return MUL_LABELS.map((l, i) => i === winnerSlot ? `**[${l}]**` : `[${l}]`).join(' ');
}

function buildEmbed(positions, step, done, amount, username, payout, multiplier, won, bonuses) {
  // Show start position + all rows up to 'step' moves
  let desc = boardRow(positions[0]) + '\n';
  for (let i = 1; i <= step; i++) {
    desc += boardRow(positions[i]) + '\n';
  }

  if (done) {
    const finalSlot = positions[ROWS];
    desc += '──────────────────\n';
    desc += prizeRow(finalSlot) + '\n\n';
    if (won) {
      desc += `✅ **${username}** wins **${payout.toLocaleString()} milk bucks**! *(${multiplier}x)*`;
      if (bonuses) desc += ` *(${bonuses})*`;
      desc += ' 🥛';
    } else {
      desc += `❌ **${username}** hit **${multiplier}x** — **${payout}** back out of **${amount}** bet. 🥛`;
    }
  }

  return new EmbedBuilder()
    .setTitle('🪣  PLINKO  🪣')
    .setDescription(desc.trim())
    .setColor(done ? (won ? 0x44ff88 : 0xff4444) : 0xffcc00)
    .setFooter({ text: `bet: ${amount} milk bucks` });
}

module.exports = {
  name: 'pl',
  aliases: ['plinko'],
  description: 'Drop the ball. 20x edges, 0.3x middle. 12 rows. Min 10 milk bucks.',
  async execute(message, args) {
    const amount = parseInt(args[0], 10);
    if (!amount || amount < MIN_BET) {
      return message.reply(`minimum bet is **${MIN_BET} milk bucks**. \`!pl <amount>\` 🥛`);
    }

    const userId   = message.author.id;
    const username = message.author.username;
    const balances = getData(balancesPath);
    const balance  = balances[userId] || 0;

    if (balance < amount) {
      return message.reply(`you only have **${balance} milk bucks**. can't bet what you don't have. 🥛`);
    }

    balances[userId] = balance - amount;
    saveData(balancesPath, balances);

    // Pre-compute full path: start at center (6), each step ±1 clamped 0–12
    const positions = [6];
    for (let i = 0; i < ROWS; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      positions.push(Math.max(0, Math.min(12, positions[i] + dir)));
    }
    const finalSlot  = positions[ROWS];
    const multiplier = MULTIPLIERS[finalSlot];
    const won        = multiplier >= 1;

    // Determine streak + multipliers (same pattern as roulette.js)
    const newStreak = won ? ws.recordWin(userId) : (ws.resetStreak(userId), 0);
    const hotMul    = (won && newStreak >= 3) ? 1.5 : 1;
    const pm        = prestige.getMultiplier(userId);
    const shopMod   = require('../shop');
    const shopMul   = won ? shopMod.getEarningsMul(userId) : 1;
    const nextMul   = won ? shopMod.getAndConsumeNextWinMul(userId) : 1;
    const payout    = won
      ? Math.floor(amount * multiplier * hotMul * pm * shopMul * nextMul)
      : Math.floor(amount * multiplier);

    const bonuses = [
      hotMul > 1 ? '🔥 1.5x streak' : '',
      pm > 1 ? `🌟 ${pm}x prestige` : '',
      (shopMul > 1 || nextMul > 1) ? `🛒 shop` : '',
    ].filter(Boolean).join(' · ');

    // Send initial frame (start position only)
    const msg = await message.channel.send({
      embeds: [buildEmbed(positions, 0, false, amount, username, payout, multiplier, won, bonuses)],
    });

    // Animate every 2 rows at 250ms — 5 edits total instead of 10
    for (let step = 2; step <= ROWS; step += 2) {
      await new Promise(r => setTimeout(r, 375));
      const isDone = step === ROWS;
      await msg.edit({
        embeds: [buildEmbed(positions, step, isDone, amount, username, payout, multiplier, won, bonuses)],
      }).catch(() => {});
    }

    // Apply payout
    if (payout > 0) {
      const freshBals = getData(balancesPath);
      freshBals[userId] = Math.min(100_000_000, (freshBals[userId] || 0) + payout);
      saveData(balancesPath, freshBals);
    }

    const xp = getData(xpPath);
    const shopXpMul = require('../shop').getXpMul(userId);
    const xpGain = won
      ? Math.min(200, Math.floor(XP_WIN * (state.doubleXp ? 2 : 1) * hotMul * pm * shopXpMul))
      : XP_LOSS;
    xp[userId] = Math.min(require('../prestige').getXpCap(userId), (xp[userId] || 0) + xpGain);
    saveData(xpPath, xp);
  },
};
