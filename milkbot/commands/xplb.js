const fs = require('fs');
const path = require('path');

const xpPath = path.join(__dirname, '../data/xp.json');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
  return level;
}

function getRank(level) {
  if (level >= 25) return 'Milk God';
  if (level >= 20) return 'Milk Legend';
  if (level >= 15) return 'Milk Hustler';
  if (level >= 10) return 'Milk Fiend';
  if (level >= 5) return 'Milk Drinker';
  return 'Milk Baby';
}

module.exports = {
  name: 'xplb',
  description: 'Shows the top 5 XP holders.',
  execute(message) {
    const xpData = getData(xpPath);

    const sorted = Object.entries(xpData)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sorted.length === 0) {
      return message.reply('Nobody has any XP yet. Play some games! 🥛');
    }

    const medals = ['👑', '🥈', '🥉', '4️⃣', '5️⃣'];

    const lines = sorted.map(([userId, totalXp], i) => {
      const member = message.guild.members.cache.get(userId);
      const name = member ? member.displayName : 'Unknown';
      const level = getLevel(totalXp);
      const rank = getRank(level);
      const line = `${medals[i]} **${name}** — Level ${level} ${rank} (${totalXp} XP)`;
      return i === 0 ? `${line} 👑` : line;
    });

    message.reply(`**XP Leaderboard** 🥛\n\n${lines.join('\n')}`);
  }
};
