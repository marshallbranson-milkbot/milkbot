// /quests — ephemeral list of the player's current daily + weekly quests with progress.

const { EmbedBuilder } = require('discord.js');
const quests = require('../dailyquests');

function progressBar(cur, max, width = 10) {
  if (max <= 0) return '─'.repeat(width);
  const pct = Math.min(1, cur / max);
  const filled = Math.round(pct * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function executeSlash(interaction) {
  const userId = interaction.user.id;
  const { daily, weekly } = quests.getUserQuests(userId);

  const fmt = (q) => {
    const bar = progressBar(q.progress, q.target);
    const done = q.claimed ? '✅ ' : '';
    return `${done}**${q.label}**\n\`${bar}\` ${q.progress}/${q.target} — **+${q.bucks.toLocaleString()}** 🥛 **+${q.xp}** XP`;
  };

  const embed = new EmbedBuilder()
    .setColor(0x4CAF50)
    .setTitle('🎯 Your Quests')
    .addFields(
      { name: '📅 Today (resets midnight EST)', value: daily.map(fmt).join('\n\n') || '*no quests*', inline: false },
      { name: '🗓️ This Week (resets Monday midnight EST)', value: weekly.map(fmt).join('\n\n') || '*no quests*', inline: false },
    )
    .setFooter({ text: 'Rewards auto-pay the moment you complete each quest.' });

  await interaction.reply({ embeds: [embed], flags: 64 });
}

module.exports = {
  name: 'quests',
  description: 'View your daily and weekly quests',
  slashOptions: [],
  executeSlash,
  execute: () => {},
};
