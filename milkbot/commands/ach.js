const fs = require('fs');
const path = require('path');
const { ACHIEVEMENTS } = require('../achievements');

const achPath = path.join(__dirname, '../data/achievements.json');

function getData() {
  if (!fs.existsSync(achPath)) return {};
  return JSON.parse(fs.readFileSync(achPath, 'utf8'));
}

module.exports = {
  name: 'ach',
  aliases: ['achievements'],
  description: 'View your achievements.',
  execute(message) {
    const userId = message.author.id;
    const allData = getData();
    const user = allData[userId] || { unlocked: [] };
    const unlocked = new Set(user.unlocked);

    const lines = ACHIEVEMENTS.map(a => {
      const done = unlocked.has(a.id);
      return `${done ? '✅' : '🔒'} ${a.emoji} **${a.name}** — ${a.desc}`;
    });

    const count = unlocked.size;
    const total = ACHIEVEMENTS.length;

    message.reply(
      `🏆 **${message.author.username}'s Achievements** — ${count}/${total} unlocked\n\n` +
      lines.join('\n')
    ).then(reply => {
      setTimeout(() => reply.delete().catch(() => {}), 60000);
      setTimeout(() => message.delete().catch(() => {}), 60000);
    });
  }
};
