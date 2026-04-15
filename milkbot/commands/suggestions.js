const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const MOD_PATH = path.join(__dirname, '../data/suggestions_mod.json');
const GUILD_ID = '562076997979865118';
const SUGGESTIONS_CHANNEL = 'milkbot-suggestions';
const BAN_DURATION    = 24 * 60 * 60 * 1000; // 24 hours
const BAD_DELETE_DELAY = 5 * 60 * 1000;       // 5 minutes

// ─── DATA HELPERS ────────────────────────────────────────────────────────────

function getMod() {
  if (!fs.existsSync(MOD_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(MOD_PATH, 'utf8')); } catch { return {}; }
}

function saveMod(data) {
  fs.writeFileSync(MOD_PATH, JSON.stringify(data, null, 2));
}

// ─── BAN LOGIC ───────────────────────────────────────────────────────────────

async function liftBan(channel, userId) {
  console.log(`[suggestions] lifting ban for ${userId}`);

  // Remove channel permission override so they can type again
  try {
    await channel.permissionOverwrites.delete(userId);
  } catch (e) {
    console.error('[suggestions] failed to remove ban overwrite:', e.message);
  }

  // Delete all their messages in the channel
  try {
    const fetched = await channel.messages.fetch({ limit: 100 });
    const toDelete = [...fetched.values()].filter(m => m.author.id === userId);
    for (const msg of toDelete) {
      await msg.delete().catch(() => {});
    }
    console.log(`[suggestions] deleted ${toDelete.length} messages from ${userId}`);
  } catch (e) {
    console.error('[suggestions] failed to delete messages on ban lift:', e.message);
  }

  // Clear their record
  const mod = getMod();
  delete mod[userId];
  saveMod(mod);
}

// Called on bot startup — restores timers for any bans that survived a restart
async function init(client) {
  const mod = getMod();
  if (Object.keys(mod).length === 0) return;

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const channel = guild.channels.cache.find(c => c.name === SUGGESTIONS_CHANNEL);
  if (!channel) return;

  for (const [userId, data] of Object.entries(mod)) {
    if (!data.bannedUntil) continue;
    const remaining = data.bannedUntil - Date.now();
    if (remaining <= 0) {
      // Ban expired while bot was offline — lift now
      await liftBan(channel, userId);
    } else {
      setTimeout(() => liftBan(channel, userId), remaining);
      console.log(`[suggestions] restored ban for ${userId}, ${Math.round(remaining / 60000)}m remaining`);
    }
  }
}

// ─── CLAUDE PROMPT ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are MilkBot, a snarky, goofy Discord bot for a small friend server of 8-10 people. You run games, manage a currency called milk bucks, and keep things entertaining.

Users are posting suggestions for improving MilkBot. Evaluate each one and reply in character:
- If the suggestion is reasonable, possible to implement, and actually useful for a Discord bot — reply warmly and enthusiastically. Be encouraging. Keep it milky and goofy.
- If the suggestion is nonsensical, impossible, absurd, or clearly trolling — dismiss it with a funny, snarky one-liner. Examples: "right into the trash 🗑️", "lmao no 🥛", "we'll put that on the list (we don't have a list)", "noted. immediately ignored."
- If the message is offensive, spammy, harassment, hate speech, or has nothing to do with suggestions at all — respond with a short firm in-character callout.

You remember the conversation so far and can respond to follow-ups naturally.

IMPORTANT: You must respond ONLY with a valid JSON object — no other text before or after it. Format:
{"type": "ok", "reply": "your response here"}

- type "ok"          → reasonable/good suggestion
- type "bad"         → nonsense, impossible, or troll suggestion
- type "inappropriate" → offensive, spammy, harassment, or totally off-topic content

The "reply" field is your plain in-character response text only.
Reply in 1-3 sentences max. Never explain your reasoning. Stay in character. Sign off with 🥛 occasionally.`;

// ─── MODULE ──────────────────────────────────────────────────────────────────

module.exports = {
  name: 'suggestions',
  init,
  check(message) {
    if (message.channel.name !== SUGGESTIONS_CHANNEL) return false;
    if (message.author.bot) return false;
    const text = message.content.trim();
    if (!text) return false;

    message.channel.sendTyping().catch(() => {});

    (async () => {
      try {
        const anthropic = new Anthropic();

        // Fetch recent channel history to give Claude conversation context
        const fetched = await message.channel.messages.fetch({ limit: 20 });
        const sorted = [...fetched.values()].reverse(); // oldest first

        const messages = [];
        for (const msg of sorted) {
          const role = msg.author.bot ? 'assistant' : 'user';
          // Bot messages stored in Discord are already plain text (not JSON)
          const content = msg.author.bot ? msg.content : `${msg.author.username}: ${msg.content}`;
          if (messages.length > 0 && messages[messages.length - 1].role === role) {
            messages[messages.length - 1].content += `\n${content}`;
          } else {
            messages.push({ role, content });
          }
        }

        while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
        if (messages.length === 0) {
          messages.push({ role: 'user', content: `${message.author.username}: ${text}` });
        }

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages,
        });

        const raw = response.content[0]?.text?.trim();
        if (!raw) return;

        // Parse JSON — fall back to treating as plain "ok" if Claude misbehaves
        let type = 'ok';
        let reply = raw;
        try {
          const parsed = JSON.parse(raw);
          type  = ['ok', 'bad', 'inappropriate'].includes(parsed.type) ? parsed.type : 'ok';
          reply = parsed.reply || raw;
        } catch {
          console.log('[suggestions] Claude response was not valid JSON, treating as ok');
        }

        const channel  = message.channel;
        const userId   = message.author.id;
        const username = message.author.username;

        // ── OK: good suggestion, keep everything ──────────────────────────────
        if (type === 'ok') {
          message.reply(reply).catch(console.error);
          return;
        }

        // ── BAD: dismissed suggestion — auto-delete after 5 min ───────────────
        if (type === 'bad') {
          const botReply = await message.reply(reply).catch(console.error);
          setTimeout(() => {
            message.delete().catch(() => {});
            if (botReply) botReply.delete().catch(() => {});
          }, BAD_DELETE_DELAY);
          return;
        }

        // ── INAPPROPRIATE: track strikes, warn, or ban ────────────────────────
        if (type === 'inappropriate') {
          const mod = getMod();
          if (!mod[userId]) mod[userId] = { count: 0, warned: false, bannedUntil: null };
          mod[userId].count++;
          saveMod(mod);

          const count = mod[userId].count;

          // Delete the bad message immediately regardless of strike number
          message.delete().catch(() => {});

          if (count === 2) {
            // Strike 2 — warn them, delete bot reply
            mod[userId].warned = true;
            saveMod(mod);

            const botReply = await channel.send(
              `⚠️ **${username}**, that's strike 2. One more inappropriate message and you're getting a **24-hour ban** from this channel. 🥛`
            ).catch(console.error);

            // Auto-delete the warning after 5 min too
            if (botReply) setTimeout(() => botReply.delete().catch(() => {}), BAD_DELETE_DELAY);

          } else if (count >= 3) {
            // Strike 3 — ban for 24 hours
            const bannedUntil = Date.now() + BAN_DURATION;
            mod[userId].bannedUntil = bannedUntil;
            saveMod(mod);

            try {
              await channel.permissionOverwrites.edit(userId, { SendMessages: false });
            } catch (e) {
              console.error('[suggestions] failed to apply ban overwrite:', e.message);
            }

            await channel.send(
              `🚫 **${username}** has been banned from this channel for **24 hours**. messages deleted on return. see ya tomorrow. 🥛`
            ).catch(console.error);

            setTimeout(() => liftBan(channel, userId), BAN_DURATION);

          } else {
            // Strike 1 — just delete the message, send bot's reply briefly
            const botReply = await channel.send(reply).catch(console.error);
            if (botReply) setTimeout(() => botReply.delete().catch(() => {}), BAD_DELETE_DELAY);
          }
        }

      } catch (err) {
        console.error('[suggestions] Claude API error:', err.message);
        message.reply(`got your suggestion, but my brain just glitched. try again later 🥛`).catch(() => {});
      }
    })();

    return true;
  }
};
