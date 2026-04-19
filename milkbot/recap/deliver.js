const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { AttachmentBuilder } = require('discord.js');

ffmpeg.setFfmpegPath(ffmpegStatic);

const DEFAULT_CHANNEL_ID = '1495507664887611505';
const DISCORD_SIZE_LIMIT_BYTES = 24 * 1024 * 1024; // leave 1 MB headroom under the 25 MB cap

async function shrinkVideo(srcPath, dstPath, crf) {
  await new Promise((resolve, reject) => {
    ffmpeg(srcPath)
      .outputOptions(['-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'])
      .on('end', () => resolve())
      .on('error', err => reject(err))
      .save(dstPath);
  });
  return fs.statSync(dstPath).size;
}

async function ensureUnderLimit(videoPath) {
  const size = fs.statSync(videoPath).size;
  if (size <= DISCORD_SIZE_LIMIT_BYTES) return videoPath;

  // Re-encode with progressively tighter CRF until under limit. Also drops to a smaller output name.
  const dir = path.dirname(videoPath);
  console.warn(`[deliver] video is ${(size / 1024 / 1024).toFixed(1)} MB — exceeds 24 MB cap, re-encoding`);
  for (const crf of [24, 28, 32]) {
    const dst = path.join(dir, `recap-shrunk-crf${crf}.mp4`);
    const newSize = await shrinkVideo(videoPath, dst, crf);
    console.log(`[deliver]   CRF ${crf} → ${(newSize / 1024 / 1024).toFixed(1)} MB`);
    if (newSize <= DISCORD_SIZE_LIMIT_BYTES) return dst;
  }
  // Still too big after max compression — return original and let Discord reject it (deliverError will fire).
  console.warn('[deliver] could not shrink below 24 MB — delivery will likely fail');
  return videoPath;
}

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

  const deliverablePath = await ensureUnderLimit(videoPath);
  const stat = fs.statSync(deliverablePath);
  const sizeMb = stat.size / (1024 * 1024);
  const filename = `milkbot-recap-${todayDate}.mp4`;
  const attachment = new AttachmentBuilder(deliverablePath, { name: filename });

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
