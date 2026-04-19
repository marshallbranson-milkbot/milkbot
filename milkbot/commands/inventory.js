const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const shop = require('../shop');

const RAIDBOSS_PATH = path.join(__dirname, '../data/raidboss.json');
const BALANCES_PATH = path.join(__dirname, '../data/balances.json');

function readRaidBoss() {
  if (!fs.existsSync(RAIDBOSS_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(RAIDBOSS_PATH, 'utf8')); }
  catch { return null; }
}
function saveRaidBoss(d) { fs.writeFileSync(RAIDBOSS_PATH, JSON.stringify(d, null, 2)); }

function readBalances() {
  if (!fs.existsSync(BALANCES_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(BALANCES_PATH, 'utf8')); }
  catch { return {}; }
}

function btn(id, label, style, disabled = false) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
}

function formatTimeLeft(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Build inventory payload ───────────────────────────────────────────────────
function buildInvPayload(userId) {
  const activeBuffs = shop.getActiveBuffs(userId);
  const inv = shop.getInventory(userId);

  const lines = [`🎒 **YOUR MILK STASH** — what you've got, what's active. 🥛`, ``];

  // Active buffs section
  if (activeBuffs.length === 0) {
    lines.push(`**⚡ ACTIVE BUFFS** — none. buy something. 🥛`);
  } else {
    lines.push(`**⚡ ACTIVE BUFFS**`);
    for (const b of activeBuffs) {
      const item = shop.ITEMS[b.itemId];
      const emoji = item?.emoji ?? '🧴';
      let status = '';
      if (b.expiresAt !== null) status = `*(${formatTimeLeft(b.expiresAt)} left)*`;
      else if (b.uses !== null) status = `*(${b.uses} use${b.uses !== 1 ? 's' : ''} left)*`;
      lines.push(`${emoji} ${b.label} ${status}`);
    }
  }

  lines.push(``);

  // Usable items section
  const invEntries = Object.entries(inv).filter(([, q]) => q > 0);
  const components = [];

  const bottomRowBtns = [btn(`inv_dismiss_${userId}`, '❌ Close', ButtonStyle.Danger)];
  if (activeBuffs.length > 0) {
    bottomRowBtns.unshift(btn(`inv_managebuffs_${userId}`, '🗑️ Remove Buff', ButtonStyle.Secondary));
  }

  if (invEntries.length === 0) {
    lines.push(`**📦 USABLE ITEMS** — empty. nothing here. go buy something. 🥛`);
    components.push(new ActionRowBuilder().addComponents(...bottomRowBtns));
  } else {
    lines.push(`**📦 USABLE ITEMS** — click to use`);
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let count = 0;

    for (const [itemId, qty] of invEntries) {
      const item = shop.ITEMS[itemId];
      if (!item) continue;
      if (count > 0 && count % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
        if (rows.length >= 3) break; // leave room for bottom row
      }
      const label = `${item.emoji} ${item.name}${qty > 1 ? ` ×${qty}` : ''}`;
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`inv_use_${itemId}_${userId}`)
          .setLabel(label.slice(0, 80))
          .setStyle(ButtonStyle.Primary)
      );
      count++;
    }
    if (count > 0) rows.push(currentRow);

    rows.push(new ActionRowBuilder().addComponents(...bottomRowBtns));
    components.push(...rows);
  }

  return { content: lines.join('\n'), components, ephemeral: true };
}

// ── Use item confirm screen ────────────────────────────────────────────────────
function buildUseConfirmPayload(userId, itemId) {
  const item = shop.ITEMS[itemId];
  if (!item) return { content: 'unknown item 🥛', components: [], ephemeral: true };

  const content = [
    `${item.emoji} **${item.name}**`,
    `> *"${item.flavorText}"*`,
    ``,
    `**Effect:** ${item.description}`,
    ``,
    `are you sure you want to use this? there is no undo.`,
  ].join('\n');

  const row = new ActionRowBuilder().addComponents(
    btn(`inv_confirm_${itemId}_${userId}`,  '✅ Use It',     ButtonStyle.Success),
    btn(`inv_discard_${itemId}_${userId}`,  '🗑️ Discard',   ButtonStyle.Danger),
    btn(`inv_back_${userId}`,               '⬅️ Never Mind', ButtonStyle.Secondary),
  );

  return { content, components: [row], ephemeral: true };
}

// ── Buff management screen ─────────────────────────────────────────────────────
function buildManageBuffsPayload(userId) {
  const activeBuffs = shop.getActiveBuffs(userId);

  if (activeBuffs.length === 0) {
    return {
      content: `no active buffs to remove. 🥛`,
      components: [new ActionRowBuilder().addComponents(btn(`inv_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary))],
      ephemeral: true,
    };
  }

  const lines = [`🗑️ **REMOVE A BUFF** — pick one to cancel it. no refunds. 🥛`, ``];
  const rows = [];
  let currentRow = new ActionRowBuilder();

  activeBuffs.forEach((b, i) => {
    const item = shop.ITEMS[b.itemId];
    const emoji = item?.emoji ?? '🧴';
    let status = '';
    if (b.expiresAt !== null) status = ` (${formatTimeLeft(b.expiresAt)} left)`;
    else if (b.uses !== null) status = ` (${b.uses} use${b.uses !== 1 ? 's' : ''} left)`;
    lines.push(`${emoji} **${b.label}**${status}`);

    if (i > 0 && i % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`inv_rmbuff_${i}_${userId}`)
        .setLabel(`🗑️ ${b.label}`.slice(0, 80))
        .setStyle(ButtonStyle.Danger)
    );
  });
  rows.push(currentRow);
  rows.push(new ActionRowBuilder().addComponents(btn(`inv_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary)));

  return { content: lines.join('\n'), components: rows, ephemeral: true };
}

// ── Buff remove confirm screen ─────────────────────────────────────────────────
function buildRemoveBuffConfirmPayload(userId, index) {
  const activeBuffs = shop.getActiveBuffs(userId);
  const b = activeBuffs[index];
  if (!b) {
    return {
      content: `that buff already expired. 🥛`,
      components: [new ActionRowBuilder().addComponents(btn(`inv_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary))],
      ephemeral: true,
    };
  }
  const item = shop.ITEMS[b.itemId];
  const emoji = item?.emoji ?? '🧴';
  let status = '';
  if (b.expiresAt !== null) status = ` — ${formatTimeLeft(b.expiresAt)} remaining`;
  else if (b.uses !== null) status = ` — ${b.uses} use${b.uses !== 1 ? 's' : ''} left`;

  const content = [
    `🗑️ **Remove ${emoji} ${b.label}?**${status}`,
    ``,
    `this buff will be **permanently cancelled**. no milk bucks refunded.`,
  ].join('\n');

  const row = new ActionRowBuilder().addComponents(
    btn(`inv_confirm_rmbuff_${index}_${userId}`, '✅ Remove It', ButtonStyle.Danger),
    btn(`inv_managebuffs_${userId}`,             '⬅️ Back',      ButtonStyle.Secondary),
  );

  return { content, components: [row], ephemeral: true };
}

// ── Boss nuke handler ─────────────────────────────────────────────────────────
async function applyBossNuke(interaction, userId, nukeValue) {
  const bossData = readRaidBoss();
  if (!bossData || !bossData.active || bossData.defeated) {
    return interaction.update({
      content: `☠️ no active boss to nuke right now. try again tonight. 🥛`,
      components: [new ActionRowBuilder().addComponents(btn(`inv_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary))],
    });
  }

  const username = interaction.user.username;
  const damageDealt = Math.min(nukeValue, bossData.currentHp);
  bossData.currentHp = Math.max(0, bossData.currentHp - nukeValue);

  // Credit the damage to the user's attack record for reward calculation
  if (!bossData.attacks[userId]) {
    bossData.attacks[userId] = { username, count: 0, lastAttack: Date.now(), totalDamage: 0 };
  }
  bossData.attacks[userId].totalDamage += damageDealt;
  bossData.attacks[userId].username = username;

  const defeated = bossData.currentHp <= 0;
  if (defeated) bossData.defeated = true;
  saveRaidBoss(bossData);

  // Announce in games channel
  const guild = interaction.guild;
  const gamesChannel = guild?.channels.cache.find(c => c.name === 'milkbot-games');
  if (gamesChannel) {
    gamesChannel.send(
      `☠️ **${username} unleashed a ${nukeValue >= 1000 ? 'DAIRY PLAGUE' : 'Boss Plague Vial'}!** ` +
      `The boss loses **${nukeValue.toLocaleString()} HP**! 💀\n` +
      `❤️ Boss HP: **${bossData.currentHp.toLocaleString()} / ${bossData.maxHp.toLocaleString()}**`
    ).catch(() => {});
  }

  // Bump boss embed
  const rbCmd = require('./raidboss');
  rbCmd.bumpBoss(interaction.client, gamesChannel ?? guild?.channels.cache.find(c => c.name === 'milkbot-games')).catch(() => {});

  if (defeated) {
    setTimeout(() => rbCmd.resolveRaidBoss(interaction.client, 'defeated').catch(console.error), 2000);
  }

  return interaction.update({
    content: `☠️ **VIAL UNLEASHED!** The boss lost **${nukeValue.toLocaleString()} HP**.\n❤️ Boss HP: **${bossData.currentHp.toLocaleString()} / ${bossData.maxHp.toLocaleString()}**${defeated ? '\n💥 **YOU KILLED IT!** rewards incoming.' : ''}`,
    components: [new ActionRowBuilder().addComponents(btn(`inv_dismiss_${userId}`, '❌ Close', ButtonStyle.Danger))],
  });
}

// ── showInventory — called from shop.js or slash command ─────────────────────
async function showInventory(interaction, userId, isNewReply = false) {
  const payload = buildInvPayload(userId);
  if (isNewReply) {
    return interaction.reply(payload);
  }
  return interaction.update(payload);
}

// ── Module exports ─────────────────────────────────────────────────────────────
module.exports = {
  name: 'inv',
  description: 'View your shop buffs and usable items.',
  slashOptions: [],
  showInventory,

  async executeSlash(interaction) {
    await showInventory(interaction, interaction.user.id, true);
  },

  async execute(message) {
    message.delete().catch(() => {});
    const r = await message.channel.send('use `/inv` to view your inventory 🥛').catch(() => null);
    setTimeout(() => r?.delete().catch(() => {}), 5000);
  },

  async handleButtonInteraction(interaction) {
    const id = interaction.customId;
    const parts = id.split('_');
    const userId = parts[parts.length - 1];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: `that's not your inventory 🥛`, ephemeral: true });
    }

    if (id.startsWith('inv_dismiss_')) {
      return interaction.update({ content: `stash closed. your items are safe. for now. 🥛`, components: [] });
    }

    if (id.startsWith('inv_back_')) {
      return showInventory(interaction, userId, false);
    }

    if (id.startsWith('inv_use_')) {
      // inv_use_{itemId}_{userId}
      const itemId = parts.slice(2, -1).join('_');
      return interaction.update(buildUseConfirmPayload(userId, itemId));
    }

    if (id.startsWith('inv_discard_')) {
      // inv_discard_{itemId}_{userId}
      const itemId = parts.slice(2, -1).join('_');
      const item = shop.ITEMS[itemId];
      const ok = shop.discardInventoryItem(userId, itemId);
      return interaction.update({
        content: ok
          ? `🗑️ **${item?.name ?? itemId}** discarded. gone forever. hope it was worth it. 🥛`
          : `you don't have that item anymore. 🥛`,
        components: [new ActionRowBuilder().addComponents(
          btn(`inv_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary),
          btn(`inv_dismiss_${userId}`, '❌ Close', ButtonStyle.Danger),
        )],
      });
    }

    if (id.startsWith('inv_managebuffs_')) {
      return interaction.update(buildManageBuffsPayload(userId));
    }

    if (id.startsWith('inv_rmbuff_')) {
      // inv_rmbuff_{index}_{userId}
      const index = parseInt(parts[parts.length - 2], 10);
      return interaction.update(buildRemoveBuffConfirmPayload(userId, index));
    }

    if (id.startsWith('inv_confirm_rmbuff_')) {
      // inv_confirm_rmbuff_{index}_{userId}
      const index = parseInt(parts[parts.length - 2], 10);
      const removed = shop.removeActiveBuff(userId, index);
      const item = removed ? shop.ITEMS[removed.itemId] : null;
      const emoji = item?.emoji ?? '🧴';
      return interaction.update({
        content: removed
          ? `🗑️ **${emoji} ${removed.label}** has been removed. the buff is gone. 🥛`
          : `that buff already expired on its own. 🥛`,
        components: [new ActionRowBuilder().addComponents(
          btn(`inv_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary),
          btn(`inv_dismiss_${userId}`, '❌ Close', ButtonStyle.Danger),
        )],
      });
    }

    if (id.startsWith('inv_confirm_')) {
      // inv_confirm_{itemId}_{userId}
      const itemId = parts.slice(2, -1).join('_');
      const result = shop.useInventoryItem(userId, itemId);

      if (!result.ok) {
        return interaction.update({
          content: `❌ ${result.message} 🥛`,
          components: [new ActionRowBuilder().addComponents(btn(`inv_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary))],
        });
      }

      if (result.type === 'boss_nuke') {
        return applyBossNuke(interaction, userId, result.value);
      }

      // cursed_orb or other
      return interaction.update({
        content: result.message,
        components: [new ActionRowBuilder().addComponents(
          btn(`inv_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary),
          btn(`inv_dismiss_${userId}`, '❌ Close', ButtonStyle.Danger),
        )],
      });
    }
  },
};
