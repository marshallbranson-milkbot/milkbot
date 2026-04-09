const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  name: 'lb',
  description: 'Shows the top 5 milk bucks holders.',
  async execute(message) {
    const balances = getData(balancesPath);

    const sorted = Object.entries(balances)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sorted.length === 0) {
      return message.reply('Nobody has any milk bucks yet. 🥛');
    }

    await message.guild.members.fetch();

    const medals = ['👑', '🥈', '🥉', '4️⃣', '5️⃣'];

    const lines = sorted.map(([userId, balance], i) => {
      const member = message.guild.members.cache.get(userId);
      const name = member ? member.displayName : 'Unknown';
      const line = `${medals[i]} **${name}** — ${balance} milk bucks`;
      return i === 0 ? `${line} 👑` : line;
    });

    message.reply(`**Milk Bucks Leaderboard** 🥛\n\n${lines.join('\n')}`);
  }
};
