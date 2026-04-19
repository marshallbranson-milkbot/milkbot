const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const shop = require('../shop');

const balancesPath = path.join(__dirname, '../data/balances.json');

function readBalances() {
  if (!fs.existsSync(balancesPath)) return {};
  try { return JSON.parse(fs.readFileSync(balancesPath, 'utf8')); }
  catch { return {}; }
}
function saveBalances(d) {
  const tmp = balancesPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, balancesPath);
}

function btn(id, label, style, disabled = false) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
}

const TIER_COLOR = { COMMON: '🟤', UNCOMMON: '🟢', RARE: '🔵', LEGENDARY: '🟡' };

// ── Browse shop ephemeral ──────────────────────────────────────────────────────
function buildBrowsePayload(userId) {
  const slots = shop.getTodaySlots();

  // Pack items 5 per row (Discord max), then add close button on its own row
  const itemRows = [];
  let currentRow = new ActionRowBuilder();
  let rowCount = 0;

  for (let i = 0; i < slots.length; i++) {
    const id = slots[i];
    const item = shop.ITEMS[id];
    if (!item) continue;
    if (i > 0 && i % 5 === 0 && itemRows.length < 4) {
      itemRows.push(currentRow);
      currentRow = new ActionRowBuilder();
      rowCount++;
    }
    const label = `${TIER_COLOR[item.tier]} ${item.emoji} ${item.name}`;
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_item_${id}_${userId}`)
        .setLabel(label.slice(0, 80))
        .setStyle(ButtonStyle.Secondary)
    );
  }
  if (currentRow.components.length > 0) itemRows.push(currentRow);

  const closeRow = new ActionRowBuilder().addComponents(
    btn(`shop_dismiss_${userId}`, '❌ Close', ButtonStyle.Danger)
  );

  return {
    content: `🛒 **TODAY'S MILK MARKET** — ten items. hand-churned. pick something or keep being broke.\n*prices refresh at midnight EST*`,
    components: [...itemRows, closeRow],
    flags: 64,
  };
}

// ── Item detail ephemeral ──────────────────────────────────────────────────────
function buildItemPayload(userId, itemId) {
  const item = shop.ITEMS[itemId];
  const balances = readBalances();
  const balance = balances[userId] || 0;
  const remaining = shop.getDailyRemaining(userId, itemId);
  const cap = shop.getDailyCap(itemId);

  const canAfford1  = balance >= item.price       && remaining >= 1;
  const canAfford5  = balance >= item.price * 5   && remaining >= 5;
  const canAfford10 = balance >= item.price * 10  && remaining >= 10;

  const tierLabel = `${TIER_COLOR[item.tier]} ${item.tier}`;
  const capLine = remaining === 0
    ? `**Daily limit reached** — resets at midnight EST`
    : `**Today's limit:** ${remaining}/${cap} remaining`;

  const content = [
    `${item.emoji} **${item.name}**  ·  ${tierLabel}`,
    `> *"${item.flavorText}"*`,
    ``,
    `**Effect:** ${item.description}`,
    `**Price:** ${item.price.toLocaleString()} 🥛  ·  **Your balance:** ${balance.toLocaleString()} 🥛`,
    capLine,
  ].join('\n');

  const buyRow = new ActionRowBuilder().addComponents(
    btn(`shop_buy_${itemId}_1_${userId}`,  'Buy ×1',  ButtonStyle.Success,  !canAfford1),
    btn(`shop_buy_${itemId}_5_${userId}`,  'Buy ×5',  ButtonStyle.Primary,  !canAfford5),
    btn(`shop_buy_${itemId}_10_${userId}`, 'Buy ×10', ButtonStyle.Primary,  !canAfford10),
    btn(`shop_back_${userId}`,             '⬅️ Back',  ButtonStyle.Secondary),
  );

  return { content, components: [buyRow], flags: 64 };
}

// ── Buy handler ────────────────────────────────────────────────────────────────
async function handleBuy(interaction, itemId, qty, userId) {
  const item = shop.ITEMS[itemId];
  if (!item) return interaction.update({ content: `unknown item. 🥛`, components: [] });

  // Daily cap check
  const remaining = shop.getDailyRemaining(userId, itemId);
  if (remaining <= 0) {
    return interaction.update({
      content: `you've hit the daily limit for **${item.name}**. come back tomorrow. 🥛`,
      components: [new ActionRowBuilder().addComponents(btn(`shop_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary))],
    });
  }
  const actualQty = Math.min(qty, remaining);

  const cost = item.price * actualQty;
  const balances = readBalances();
  const balance = balances[userId] || 0;

  if (balance < cost) {
    return interaction.update({
      content: `you need **${cost.toLocaleString()} 🥛** but only have **${balance.toLocaleString()} 🥛**. broke behavior. 🥛`,
      components: [new ActionRowBuilder().addComponents(btn(`shop_back_${userId}`, '⬅️ Back', ButtonStyle.Secondary))],
    });
  }

  // Deduct balance
  balances[userId] = balance - cost;

  const cappedNote = actualQty < qty ? ` *(capped at daily limit — wanted ${qty}, got ${actualQty})*` : '';
  let resultLines = [`✅ bought **${actualQty}x ${item.emoji} ${item.name}** for **${cost.toLocaleString()} 🥛**${cappedNote}`];
  resultLines.push(`💰 balance: **${balances[userId].toLocaleString()} 🥛**`);

  for (let i = 0; i < actualQty; i++) {
    const result = shop.applyItemPurchase(userId, itemId);
    if (result.instant) {
      balances[userId] = Math.min(100_000_000, (balances[userId] || 0) + result.instant);
      resultLines.push(`💸 ${result.message}`);
    } else if (i === 0) {
      resultLines.push(result.queued ? `📦 ${result.message}` : `🧴 ${result.message}`);
    }
  }

  saveBalances(balances);
  shop.recordDailyPurchase(userId, itemId, actualQty);

  const backRow = new ActionRowBuilder().addComponents(
    btn(`shop_back_${userId}`, '⬅️ Back to Shop', ButtonStyle.Secondary),
    btn(`shop_dismiss_${userId}`, '❌ Close', ButtonStyle.Danger),
  );

  return interaction.update({ content: resultLines.join('\n'), components: [backRow] });
}

// ── Slash command ──────────────────────────────────────────────────────────────
module.exports = {
  name: 'shop',
  description: 'Browse the Milk Market and buy buffs.',
  slashOptions: [],

  async executeSlash(interaction) {
    await interaction.reply(buildBrowsePayload(interaction.user.id));
  },

  async execute(message) {
    message.delete().catch(() => {});
    const r = await message.channel.send('use `/shop` to open the market 🥛').catch(() => null);
    setTimeout(() => r?.delete().catch(() => {}), 5000);
  },

  async handleButtonInteraction(interaction) {
    const id = interaction.customId;
    const parts = id.split('_');

    // shop_browse — from public embed, new ephemeral reply
    if (id === 'shop_browse') {
      return interaction.reply(buildBrowsePayload(interaction.user.id));
    }

    // shop_inv — from public embed, delegate to inventory display
    if (id === 'shop_inv') {
      const inv = require('./inventory');
      return inv.showInventory(interaction, interaction.user.id, true);
    }

    // All remaining buttons carry userId at the end
    const userId = parts[parts.length - 1];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: `that's not your shop menu 🥛`, flags: 64 });
    }

    if (id.startsWith('shop_dismiss_')) {
      return interaction.update({ content: `shop closed. your milk bucks are safe. for now. 🥛`, components: [] });
    }

    if (id.startsWith('shop_back_')) {
      return interaction.update(buildBrowsePayload(userId));
    }

    if (id.startsWith('shop_item_')) {
      // shop_item_{itemId}_{userId}
      const itemId = parts.slice(2, -1).join('_');
      return interaction.update(buildItemPayload(userId, itemId));
    }

    if (id.startsWith('shop_buy_')) {
      // shop_buy_{itemId}_{qty}_{userId}
      const qty = parseInt(parts[parts.length - 2], 10);
      if (![1, 5, 10].includes(qty)) return interaction.update({ content: `invalid quantity 🥛`, components: [] });
      const itemId = parts.slice(2, -2).join('_');
      if (!shop.ITEMS[itemId]) return interaction.update({ content: `unknown item 🥛`, components: [] });
      return handleBuy(interaction, itemId, qty, userId);
    }
  },
};
