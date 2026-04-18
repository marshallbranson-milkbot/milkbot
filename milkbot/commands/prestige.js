const fs = require('fs');
const path = require('path');
const prestige = require('../prestige');

const xpPath = path.join(__dirname, '../data/xp.json');

function getLevel(totalXp) {
  let level = 1;
  let xpUsed = 0;
  while (true) {
    const needed = level * 100;
    if (xpUsed + needed > totalXp) break;
    xpUsed += needed;
    level++;
  }
  return level;
}

module.exports = {
  name: 'prestige',
  aliases: ['pr'],
  description: 'Prestige at level 25 to reset XP and gain a permanent multiplier.',
  execute(message) {
    const userId = message.author.id;

    let xpData = {};
    if (fs.existsSync(xpPath)) {
      try { xpData = JSON.parse(fs.readFileSync(xpPath, 'utf8')); }
      catch (e) { console.error('[prestige] corrupted xp:', e.message); }
    }
    const totalXp = xpData[userId] || 0;
    const level = getLevel(totalXp);
    const currentPrestige = prestige.getPrestige(userId);

    if (level < 100) {
      return message.reply(
        `You need to be **level 100** to prestige. You're level **${level}**. ` +
        `${100 - level} more level${100 - level === 1 ? '' : 's'} to go. Keep drinking. 🥛`
      );
    }

    if (currentPrestige >= 5) {
      return message.reply(`you're already at **Prestige 5** — maximum prestige. there is no higher. you've broken the dairy ceiling. 🥛`);
    }

    const newPrestige = prestige.doPrestige(userId);
    const newMultiplier = newPrestige + 1;

    message.channel.send(
      `🌟 **${message.author.username} HAS PRESTIGED!** 🌟\n\n` +
      `They've reached **Prestige ${newPrestige}** — ` +
      `all game XP and milk buck gains are permanently **${newMultiplier}x**.\n` +
      `XP and milk bucks reset to zero. The grind restarts. Can they do it again? 🥛`
    );

    message.reply(
      `✅ You are now **Prestige ${newPrestige}** — **${newMultiplier}x** on all game earnings and XP.\n` +
      `Your XP and milk bucks have been wiped. Level up again for even more. 🌟`
    );
  }
};
