const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const state = require('../state');
const { getMultiplier } = require('../prestige');

const GUILD_ID       = '562076997979865118';
const DATA_PATH      = path.join(__dirname, '../data/raidboss.json');
const BALANCES_PATH  = path.join(__dirname, '../data/balances.json');
const XP_PATH        = path.join(__dirname, '../data/xp.json');

const MAX_HP         = 4000;
const ATTACK_COOLDOWN = 60 * 60 * 1000; // 1 hour
const RISK_CHANCE    = 0.15;

const BOSSES = [
  {
    name: 'THE CURDFATHER',
    art: '  🍼💀🍼\n(  >🐄<  )\n /|     |\\\n🥛       🥛',
    lore: '"You come to me, on the day of my souring..."',
  },
  {
    name: 'SPOILED MILK SPECTER',
    art: '  👻🥛👻\n  ～～～\n (  👁👁  )\n  ~~🥛~~',
    lore: '"I have been in the fridge for three weeks. You will not survive me."',
  },
  {
    name: 'LORD LACTOSE',
    art: '  💀🐮💀\n [🐄💀🐄]\n \\(⚔️ ⚔️)/\n   |    |',
    lore: '"Every gallon you drink... feeds my power."',
  },
  {
    name: 'THE WHEY REAPER',
    art: '  ⚰️🥛⚰️\n    ☠️\n (🥛☠️🥛)\n   ⚔️  ⚔️',
    lore: '"Protein is my domain. You cannot out-lift death."',
  },
  {
    name: 'MOOTILDA THE MERCILESS',
    art: '  🐄🔥🐄\n  🔥🐄🔥\n  (>⚡<)\n  /🥛 🥛\\',
    lore: '"I give the milk. I take it back. This is my nature."',
  },
  {
    name: 'THE UDDER DESTROYER',
    art: '  💥🍼💥\n  💥💥💥\n(🐄UDDER🐄)\n  💥💥💥',
    lore: '"No more milk. No more mercy. Only destruction."',
  },
  {
    name: 'COUNT LACTULA',
    art: '  🧛🥛🧛\n    🧛‍♂️\n  (>🥛<)\n   /\\  /\\',
    lore: '"I vant to drink your... dairy products."',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function readData() {
  if (!fs.existsSync(DATA_PATH)) return { active: false };
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch { return { active: false }; }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function readBalances() {
  if (!fs.existsSync(BALANCES_PATH)) return {};
  return JSON.parse(fs.readFileSync(BALANCES_PATH, 'utf8'));
}

function readXp() {
  if (!fs.existsSync(XP_PATH)) return {};
  return JSON.parse(fs.readFileSync(XP_PATH, 'utf8'));
}

function buildHpBar(current, max) {
  const pct = Math.max(0, current / max);
  const filled = Math.round(pct * 20);
  const empty = 20 - filled;
  const pctStr = Math.round(pct * 100);
  return `[${'\u2588'.repeat(filled)}${'\u2591'.repeat(empty)}] ${current.toLocaleString()} / ${max.toLocaleString()}  (${pctStr}%)`;
}

function timeRemaining(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function buildAttackerLines(attacks) {
  const sorted = Object.values(attacks).sort((a, b) => b.totalDamage - a.totalDamage).slice(0, 8);
  if (sorted.length === 0) return '*(none yet — be first)*';
  const medals = ['🥇', '🥈', '🥉'];
  return sorted.map((p, i) => {
    const medal = medals[i] ?? '▸';
    return `${medal} **${p.username}** — ${p.count} hit${p.count !== 1 ? 's' : ''} · ${p.totalDamage} dmg`;
  }).join('\n');
}

function buildEmbed(bossData, { defeated = false, escaped = false } = {}) {
  const boss = BOSSES[bossData.bossIndex % BOSSES.length];
  const hpBar = buildHpBar(bossData.currentHp, bossData.maxHp);
  const attackerLines = buildAttackerLines(bossData.attacks || {});

  let title, color, footer;
  if (defeated) {
    title = `💀 ${boss.name} HAS BEEN SLAIN 💀`;
    color = 0x44ff88;
    footer = 'the dairy is safe. for now. 🥛';
  } else if (escaped) {
    title = `😈 ${boss.name} HAS ESCAPED 😈`;
    color = 0xff4444;
    footer = 'it got away. try harder tomorrow. 🥛';
  } else {
    title = `🐄 RAID BOSS HAS APPEARED 🐄`;
    color = 0xff6600;
    footer = '1 attack per hour · rewards scale with participation 🥛';
  }

  const desc = [
    `\`\`\``,
    boss.art,
    `\`\`\``,
    `**${boss.name}**`,
    boss.lore,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `❤️ HP  ${hpBar}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `⚔️ **ATTACKERS**`,
    attackerLines,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    defeated || escaped
      ? `⏱️ Battle ended`
      : `⏰ Expires in ${timeRemaining(bossData.expiresAt)}`,
    `⚠️ 15% chance to lose milk bucks · 1 attack per hour`,
    `🏆 Reward on defeat: **60 🥛 per attack** (prestige multiplied)`,
  ].join('\n');

  return new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setFooter({ text: footer });
}

function buildAttackButton(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rb_attack')
      .setLabel('⚔️ Attack')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

let expiryTimeout = null;

// ── Spawn ──────────────────────────────────────────────────────────────────────

async function spawnBoss(client) {
  // Resolve any leftover boss first (safety guard)
  const prev = readData();
  if (prev.active && !prev.defeated) {
    await resolveRaidBoss(client, 'expired', prev).catch(console.error);
  }

  const guild = client.guilds.cache.get(GUILD_ID);
  const channel = guild?.channels.cache.find(c => c.name === 'milkbot-games');
  if (!channel) { console.log('[raidboss] milkbot-games not found'); return; }

  const prevIndex = prev.bossIndex ?? -1;
  const bossIndex = (prevIndex + 1) % BOSSES.length;
  const boss = BOSSES[bossIndex];

  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000;

  const bossData = {
    active: true,
    bossIndex,
    spawnedAt: now,
    expiresAt,
    maxHp: MAX_HP,
    currentHp: MAX_HP,
    defeated: false,
    defeatedAt: null,
    messageId: null,
    channelId: channel.id,
    attacks: {},
  };

  const msg = await channel.send({
    embeds: [buildEmbed(bossData)],
    components: [buildAttackButton()],
  }).catch(console.error);

  if (!msg) { console.log('[raidboss] failed to send boss message'); return; }

  bossData.messageId = msg.id;
  saveData(bossData);
  state.activeRaidBoss = { name: boss.name, currentHp: MAX_HP, maxHp: MAX_HP };

  console.log(`[raidboss] spawned: ${boss.name}`);

  // Arm expiry
  if (expiryTimeout) clearTimeout(expiryTimeout);
  expiryTimeout = setTimeout(() => resolveRaidBoss(client, 'expired').catch(console.error), 24 * 60 * 60 * 1000);
}

// ── Resolve ────────────────────────────────────────────────────────────────────

async function resolveRaidBoss(client, reason, bossDataOverride = null) {
  const bossData = bossDataOverride ?? readData();
  if (!bossData.active) return; // already resolved

  bossData.active = false;
  if (reason === 'defeated') bossData.defeatedAt = Date.now();
  saveData(bossData);
  state.activeRaidBoss = null;
  if (expiryTimeout) { clearTimeout(expiryTimeout); expiryTimeout = null; }

  // Edit the boss message to show final state
  const guild = client.guilds.cache.get(GUILD_ID);
  const channel = guild?.channels.cache.get(bossData.channelId)
    ?? guild?.channels.cache.find(c => c.name === 'milkbot-games');

  if (channel && bossData.messageId) {
    const msg = await channel.messages.fetch(bossData.messageId).catch(() => null);
    if (msg) {
      await msg.edit({
        embeds: [buildEmbed(bossData, { defeated: reason === 'defeated', escaped: reason === 'expired' })],
        components: [buildAttackButton(true)],
      }).catch(console.error);
    }
  }

  // Calculate and distribute rewards
  const balances = readBalances();
  const xpData = readXp();
  const attackers = Object.entries(bossData.attacks);

  if (attackers.length === 0) {
    const noOneMsg = await channel?.send(
      reason === 'defeated'
        ? `💀 **${BOSSES[bossData.bossIndex % BOSSES.length].name}** was defeated... but nobody attacked it? How. 🥛`
        : `😈 **${BOSSES[bossData.bossIndex % BOSSES.length].name}** escaped. Nobody even tried. Shameful. 🥛`
    ).catch(console.error);
    if (noOneMsg) setTimeout(() => noOneMsg.delete().catch(() => {}), 10 * 60 * 1000);
    return;
  }

  const boss = BOSSES[bossData.bossIndex % BOSSES.length];
  const resultLines = [];
  const medals = ['🥇', '🥈', '🥉'];
  const sortedAttackers = attackers.sort(([, a], [, b]) => b.count - a.count);

  for (const [userId, record] of sortedAttackers) {
    let reward, xpGain;
    if (reason === 'defeated') {
      const pm = getMultiplier(userId);
      reward = Math.floor(record.count * 60 * pm);
      xpGain = Math.min(200, record.count * 30 + record.count * 50); // per-attack + defeat bonus
    } else {
      reward = record.count * 20;
      xpGain = Math.min(200, record.count * 30);
    }
    if (state.doubleXp) xpGain = Math.min(200, xpGain * 2);

    balances[userId] = (balances[userId] || 0) + reward;
    xpData[userId] = Math.min(30000, (xpData[userId] || 0) + xpGain);

    const i = sortedAttackers.findIndex(([id]) => id === userId);
    const medal = medals[i] ?? '▸';
    resultLines.push(`${medal} **${record.username}** — ${record.count} attack${record.count !== 1 ? 's' : ''} · **+${reward.toLocaleString()} 🥛** · +${xpGain} XP`);
  }

  fs.writeFileSync(BALANCES_PATH, JSON.stringify(balances, null, 2));
  fs.writeFileSync(XP_PATH, JSON.stringify(xpData, null, 2));

  const totalAttacks = attackers.reduce((s, [, r]) => s + r.count, 0);

  let summary;
  if (reason === 'defeated') {
    summary = [
      `🎉 **${boss.name} HAS BEEN DEFEATED!** 🎉`,
      `${totalAttacks} total attacks. The dairy is safe. Rewards below.`,
      ``,
      resultLines.join('\n'),
      ``,
      `*prestige multipliers applied · see you at midnight 🥛*`,
    ].join('\n');
  } else {
    summary = [
      `💀 **${boss.name} ESCAPED INTO THE NIGHT.** 💀`,
      `It survived with **${bossData.currentHp.toLocaleString()} HP** remaining. Consolation payout below.`,
      ``,
      resultLines.join('\n'),
      ``,
      `*come back stronger tomorrow. midnight EST. 🥛*`,
    ].join('\n');
  }

  const resMsg = await channel?.send(summary).catch(console.error);
  if (resMsg) setTimeout(() => resMsg.delete().catch(() => {}), 10 * 60 * 1000);
  console.log(`[raidboss] resolved (${reason}): ${boss.name}, ${attackers.length} attackers`);
}

// ── Handle button interaction ──────────────────────────────────────────────────

async function handleInteraction(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  const bossData = readData();
  if (!bossData.active || bossData.defeated) {
    return interaction.editReply({ content: `🐄 No raid boss active right now. Check back at midnight EST. 🥛` });
  }

  // Cooldown check
  const record = bossData.attacks[userId];
  if (record) {
    const elapsed = Date.now() - record.lastAttack;
    const remaining = ATTACK_COOLDOWN - elapsed;
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000);
      return interaction.editReply({ content: `⏳ Your sword needs sharpening. Attack again in **${mins} minute${mins !== 1 ? 's' : ''}**. 🥛` });
    }
  }

  // Roll damage
  const damage = Math.floor(Math.random() * 81) + 40;
  bossData.currentHp = Math.max(0, bossData.currentHp - damage);

  // Roll risk
  let riskMsg = '';
  const balances = readBalances();
  if (Math.random() < RISK_CHANCE) {
    const bal = balances[userId] || 0;
    const loss = Math.max(25, Math.min(300, Math.floor(bal * 0.05)));
    balances[userId] = Math.max(0, bal - loss);
    fs.writeFileSync(BALANCES_PATH, JSON.stringify(balances, null, 2));
    riskMsg = `\n💸 The boss counter-attacked! You lost **${loss} 🥛**.`;
  }

  // Record attack
  if (!bossData.attacks[userId]) {
    bossData.attacks[userId] = { username, count: 0, lastAttack: 0, totalDamage: 0 };
  }
  bossData.attacks[userId].count++;
  bossData.attacks[userId].lastAttack = Date.now();
  bossData.attacks[userId].totalDamage += damage;
  bossData.attacks[userId].username = username; // keep display name fresh

  const defeated = bossData.currentHp <= 0;
  if (defeated) bossData.defeated = true;
  saveData(bossData);
  state.activeRaidBoss = { name: BOSSES[bossData.bossIndex % BOSSES.length].name, currentHp: bossData.currentHp, maxHp: bossData.maxHp };

  // Update boss message
  const guild = interaction.guild;
  const channel = guild?.channels.cache.get(bossData.channelId)
    ?? guild?.channels.cache.find(c => c.name === 'milkbot-games');
  if (channel && bossData.messageId) {
    const msg = await channel.messages.fetch(bossData.messageId).catch(() => null);
    if (msg) {
      await msg.edit({
        embeds: [buildEmbed(bossData, { defeated })],
        components: [buildAttackButton(defeated)],
      }).catch(console.error);
    }
  }

  const myRecord = bossData.attacks[userId];
  const reply = [
    `⚔️ You hit **${BOSSES[bossData.bossIndex % BOSSES.length].name}** for **${damage} damage**!`,
    `❤️ Boss HP: **${bossData.currentHp.toLocaleString()} / ${bossData.maxHp.toLocaleString()}**`,
    `📊 Your attacks this boss: **${myRecord.count}** (${myRecord.totalDamage} total dmg)`,
    riskMsg,
    defeated ? `\n💥 **YOU LANDED THE KILLING BLOW!** Rewards incoming.` : ``,
  ].filter(Boolean).join('\n');

  await interaction.editReply({ content: reply });

  if (defeated) {
    // Short delay so the embed update lands first
    setTimeout(() => resolveRaidBoss(interaction.client, 'defeated').catch(console.error), 2000);
  }
}

// ── Restore on bot restart ─────────────────────────────────────────────────────

async function restoreOnStartup(client) {
  const bossData = readData();
  if (!bossData.active || bossData.defeated) return;

  const remaining = bossData.expiresAt - Date.now();
  if (remaining <= 0) {
    await resolveRaidBoss(client, 'expired', bossData).catch(console.error);
    return;
  }

  const boss = BOSSES[bossData.bossIndex % BOSSES.length];
  state.activeRaidBoss = { name: boss.name, currentHp: bossData.currentHp, maxHp: bossData.maxHp };

  if (expiryTimeout) clearTimeout(expiryTimeout);
  expiryTimeout = setTimeout(() => resolveRaidBoss(client, 'expired').catch(console.error), remaining);

  console.log(`[raidboss] restored: ${boss.name}, ${bossData.currentHp}/${bossData.maxHp} HP, expires in ${Math.ceil(remaining / 3600000)}h`);
}

// ── Module exports ─────────────────────────────────────────────────────────────

module.exports = {
  name: 'rb',
  spawnBoss,
  handleInteraction,
  restoreOnStartup,
};
