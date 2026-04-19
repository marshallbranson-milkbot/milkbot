const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const DEFAULT_CHANNEL_ID = '1495507664887611505';

function buildMessageBody({ script, caption, hashtags, topEvent, todayDate }) {
  const tagLine = (hashtags && hashtags.length)
    ? hashtags.map(h => `#${h}`).join(' ')
    : '';

  const lines = [
    `**MilkBot Daily Recap — ${todayDate}**`,
    '',
    `**Caption:**`,
    '```',
    `${caption}${tagLine ? '\n\n' + tagLine : ''}`,
    '```',
    '',
    `**Script (spoken):**`,
    `> ${(script || '').replace(/\n/g, '\n> ')}`,
  ];

  if (topEvent) {
    lines.push('', `**Hook source:** \`${topEvent.type}\` — ${topEvent.summary}`);
  }

  lines.push('', `download the mp4, upload to tiktok, copy the caption + tags above. 🥛`);

  return lines.join('\n').slice(0, 1900);
}

async function deliverRecap(client, { videoPath, script, caption, hashtags, topEvent, todayDate }) {
  const channelId = process.env.RECAP_DROP_CHANNEL_ID || DEFAULT_CHANNEL_ID;
  const channel = await client.channels.fetch(channelId).catch(err => {
    throw new Error(`Failed to fetch drop channel ${channelId}: ${err.message}`);
  });
  if (!channel || !channel.isTextBased || !channel.isTextBased()) {
    throw new Error(`Drop channel ${channelId} is not a text channel`);
  }

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file missing: ${videoPath}`);
  }

  const stat = fs.statSync(videoPath);
  const sizeMb = stat.size / (1024 * 1024);
  const filename = `milkbot-recap-${todayDate}.mp4`;
  const attachment = new AttachmentBuilder(videoPath, { name: filename });

  const body = buildMessageBody({ script, caption, hashtags, topEvent, todayDate });

  await channel.send({
    content: body,
    files: [attachment],
  });

  console.log(`[deliver] posted recap (${sizeMb.toFixed(2)} MB) to channel ${channelId}`);
}

async function deliverError(client, { todayDate, error, phase }) {
  const channelId = process.env.RECAP_DROP_CHANNEL_ID || DEFAULT_CHANNEL_ID;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  await channel.send({
    content: `⚠️ **Recap failed** — ${todayDate}\n**Phase:** ${phase}\n**Error:** \`${(error.message || String(error)).slice(0, 500)}\``,
  }).catch(() => {});
}

module.exports = { deliverRecap, deliverError };
