const fs = require('fs');
const path = require('path');

const xpPath = path.join(__dirname, '../data/xp.json');
const prestige = require('../prestige');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { console.error('[getData] corrupted:', filePath); return {}; }
}

function getLevel(totalXp) {
  let level = 1;
  let xpUsed = 0;
  while (true) {
    const needed = level * 100;
    if (xpUsed + needed > totalXp) break;
    xpUsed += needed;
    level++;
  }
  return { level, xpIntoLevel: totalXp - xpUsed, xpForNext: level * 100 };
}

function getRank(level) {
  if (level >= 50) return 'THE ONE TRUE MOO';
  if (level >= 45) return 'Milk Eternal';
  if (level >= 40) return 'Milk God';
  if (level >= 35) return 'Milk Overlord';
  if (level >= 30) return 'Milk Legend';
  if (level >= 25) return 'Milk Baron';
  if (level >= 20) return 'Milk Dealer';
  if (level >= 15) return 'Milk Hustler';
  if (level >= 10) return 'Milk Fiend';
  if (level >= 5)  return 'Milk Drinker';
  return 'Milk Baby';
}

module.exports = {
  name: 'xp',
  description: 'Check your XP, level, and rank.',
  execute(message) {
    const xpData = getData(xpPath);
    const totalXp = xpData[message.author.id] || 0;
    const { level, xpIntoLevel, xpForNext } = getLevel(totalXp);
    const rank = getRank(level);
    const prestigeLevel = prestige.getPrestige(message.author.id);
    const multiplier = prestige.getMultiplier(message.author.id);
    const levelCap = prestige.getLevelCap(message.author.id);
    const isMaxed = level >= levelCap;

    const prestigeLine = prestigeLevel > 0
      ? `**Prestige:** ${prestigeLevel} *(${multiplier}x on all game gains)*\n`
      : '';

    const xpLine = isMaxed
      ? `**XP:** MAX — prestige to keep earning 🌟`
      : `**XP:** ${xpIntoLevel} / ${xpForNext} (${totalXp} total)`;

    message.reply(
      `**${message.author.username}'s Stats** 🥛\n` +
      prestigeLine +
      `**Rank:** ${rank}\n` +
      `**Level:** ${level}${isMaxed ? ' *(MAX)*' : ''}\n` +
      xpLine
    ).then(reply => {
      setTimeout(() => { reply.delete().catch(() => {}); message.delete().catch(() => {}); }, 8000);
    });
  }
};
