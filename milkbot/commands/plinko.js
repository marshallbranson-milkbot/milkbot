const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath       = path.join(__dirname, '../data/xp.json');
const state    = require('../state');
const ws       = require('../winstreak');
const prestige = require('../prestige');

const MIN_BET = 10;
const ROWS = 8;
const MULTIPLIERS = [5, 2, 1.2, 0.5, 0.2, 0.5, 1.2, 2, 5];
const MUL_LABELS  = ['5x', '2x', '1.2x', '0.5x', '0.2x', '0.5x', '1.2x', '2x', '5x'];
const XP_WIN = 30;
const XP_LOSS = 5;

function getData(p) {
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function saveData(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

function boardRow(ballPos) {
  return Array.from({ length: 9 }, (_, i) => i === ballPos ? '🟡' : '⬛').join('');
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
  description: 'Drop the ball. 10x edges, 0.3x middle. Min 10 milk bucks.',
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

    // Pre-compute full path: start at 3 (center), each step ±1 clamped 0–6
    const positions = [4];
    for (let i = 0; i < ROWS; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      positions.push(Math.max(0, Math.min(8, positions[i] + dir)));
    }
    const finalSlot  = positions[ROWS];
    const multiplier = MULTIPLIERS[finalSlot];
    const won        = multiplier >= 1;

    // Determine streak + multipliers (same pattern as roulette.js)
    const newStreak = won ? ws.recordWin(userId) : (ws.resetStreak(userId), 0);
    const hotMul    = (won && newStreak >= 3) ? 1.5 : 1;
    const pm        = prestige.getMultiplier(userId);
    const payout    = won
      ? Math.floor(amount * multiplier * hotMul * pm)
      : Math.floor(amount * multiplier);

    const bonuses = [
      hotMul > 1 ? '🔥 1.5x streak' : '',
      pm > 1 ? `🌟 ${pm}x prestige` : '',
    ].filter(Boolean).join(' · ');

    // Send initial frame (start position only)
    const msg = await message.channel.send({
      embeds: [buildEmbed(positions, 0, false, amount, username, payout, multiplier, won, bonuses)],
    });

    // Animate: add one row per edit (500ms apart), final edit shows prize row
    for (let step = 1; step <= ROWS; step++) {
      await new Promise(r => setTimeout(r, 500));
      const isDone = step === ROWS;
      await msg.edit({
        embeds: [buildEmbed(positions, step, isDone, amount, username, payout, multiplier, won, bonuses)],
      }).catch(() => {});
    }

    // Apply payout
    if (payout > 0) {
      const freshBals = getData(balancesPath);
      freshBals[userId] = Math.min(10_000_000, (freshBals[userId] || 0) + payout);
      saveData(balancesPath, freshBals);
    }

    const xp = getData(xpPath);
    const xpGain = won
      ? Math.min(200, Math.floor(XP_WIN * (state.doubleXp ? 2 : 1) * hotMul * pm))
      : XP_LOSS;
    xp[userId] = Math.min(require('../prestige').getXpCap(userId), (xp[userId] || 0) + xpGain);
    saveData(xpPath, xp);
  },
};
