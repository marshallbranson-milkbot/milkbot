const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

const balancesPath = path.join(__dirname, 'data/balances.json');
const xpPath = path.join(__dirname, 'data/xp.json');
const bigTradesPath = path.join(__dirname, 'data/bigtrades.json');
const prestige = require('./prestige');
const { STOCK_DEFS, getPrices, getStats, getRecentHistory } = require('./stockdata');

// Render a 20-tick unicode sparkline. Maps each price to one of 8 block chars
// based on its position between the min and max of the series.
const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
function buildSparkline(points) {
  if (!points || points.length === 0) return '────────────────────';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;
  if (range === 0) return '─'.repeat(Math.max(points.length, 20));
  const bars = points.map(p => {
    const idx = Math.min(SPARK_CHARS.length - 1, Math.floor(((p - min) / range) * SPARK_CHARS.length));
    return SPARK_CHARS[idx];
  }).join('');
  // Left-pad with dashes if we have fewer than 20 ticks
  return bars.length < 20 ? '─'.repeat(20 - bars.length) + bars : bars;
}
const jackpot = require('./jackpot');
const GUILD_ID = '562076997979865118';
const STOCK_MAP = Object.fromEntries(STOCK_DEFS.map(s => [s.ticker, s]));
const { getMilkLordId } = require('./commands/milklord');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { console.error('[display] corrupted:', filePath); return {}; }
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
  if (level >= 50) return 'THE ONE TRUE MOO';
  if (level >= 45) return 'Milk Eternal';
  if (level >= 40) return 'Milk God';
  if (level >= 35) return 'Milk Overlord';
  if (level >= 30) return 'Milk Legend';
  if (level >= 25) return 'Milk Baron';
  if (level >= 20) return 'Milk Dealer';
  if (level >= 15) return 'Milk Hustler';
  if (level >= 10) return 'Milk Fiend';
  if (level >= 5)  return 'Milk Drinker';
  return 'Milk Baby';
}

const HELP_CATEGORIES = {
  currency: {
    label: '💰 Your Milk Bucks',
    description: 'Balance, XP, daily rewards, and achievements.',
    commands: [
      '`!bal` — how broke are you right now',
      '`!xp` — your XP, level, and rank (cap 50 · prestige 5 = no cap)',
      '`!prestige` — reset at level 50 for a permanent multiplier (max prestige 5)',
      '`!ach` — view your achievements',
      '`!da` — grab your daily milk bucks (streaks pay up to 300)',
      '`!cc` — claim a crate drop before someone else does (500 milk bucks)',
      '`!give @user amount` — send milk bucks to another player',
    ],
  },
  casino: {
    label: '🎰 Casino',
    description: 'Slots, roulette, plinko, lottery, and more.',
    commands: [
      '`!sl` — spin the slots for 10 milk bucks',
      '`!rou amount red/black/number` — roulette. colors pay 2x, numbers pay 35x',
      '`!pl amount` — plinko. drop the ball. 5x edges, 0.2x middle. (min 10)',
      '`!lt tickets` — buy lottery tickets (10 🥛 each). midnight drawing. one winner takes it all.',
      '`!fh amount` — flip against MilkBot directly (good luck)',
      '`!cf @user amount` — challenge someone to a coinflip',
      '`!a` / `!d` — accept or decline a coinflip',
    ],
  },
  cards: {
    label: '🃏 Cards',
    description: 'Blackjack and tournaments.',
    commands: [
      '`!bl amount` — blackjack vs MilkBot (min 25 · blackjack pays 3:2)',
      '`!bjt buy-in` — blackjack tournament. 30s join window, everyone vs dealer, winners take 2x. (min 50)',
    ],
  },
  social: {
    label: '⚔️ Social',
    description: 'Raids, robbing, trivia, and word games.',
    commands: [
      '`!ra amount` — start a raid, crew joins with `!j`',
      '`!ro @user` — rob someone. 25% chance it works. 2hr cooldown.',
      '`!sc` — unscramble the word (3/letter, rare words 10/letter)',
      '`!mt` — milk trivia, A/B/C, first right answer wins · 15 milk bucks',
      '`!tr` — trivia crack, spin for 1 of 6 categories, A/B/C/D · 20 milk bucks',
      '`!geo` — name the country from the flag · 25 milk bucks',
    ],
  },
  stocks: {
    label: '📈 Stocks',
    description: 'Buy, sell, and manage your portfolio.',
    commands: [
      '`/b TICKER shares` — buy shares',
      '`/ba TICKER` — buy as many shares as you can afford',
      '`/s TICKER shares|all` — dump shares',
      '`/port` — view your portfolio (select a stock to buy all, sell all, buy amount, or sell amount)',
      '📊 Live prices + 7-day stats → **#milkbot-stocks-info**',
    ],
  },
};

function buildHelpEmbed(userId = 'public') {
  const isPublic = userId === 'public';
  const embed = new EmbedBuilder()
    .setTitle('🥛  M I L K B O T')
    .setDescription(
      isPublic
        ? `> *get rich or go broke.*\n\n` +
          `**🎮 GAMES** — \`#milkbot-games\`\n` +
          `\`/g\` — game menu *(only you can see it)*\n\n` +
          `**📈 STOCKS** — \`#milkbot-stocks\`\n` +
          `\`/port\` — portfolio · \`/b\` · \`/s\` · \`/ba\`\n\n` +
          `*type \`!h\` for all commands 🥛*`
        : `> *get rich or go broke.*\n\n` +
          `select a category below to see all commands:`
    )
    .setColor(0xffffff)
    .setFooter({ text: 'milk bucks. everything here costs milk bucks. 🥛' });

  if (isPublic) return { embeds: [embed], components: [] };

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`help_cat_${userId}`)
    .setPlaceholder('browse commands...')
    .addOptions(
      Object.entries(HELP_CATEGORIES).map(([value, { label, description }]) =>
        new StringSelectMenuOptionBuilder().setLabel(label).setValue(value).setDescription(description)
      )
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function buildCategoryReply(category) {
  const cat = HELP_CATEGORIES[category];
  if (!cat) return { content: 'unknown category 🥛', flags: 64 };
  return {
    content: `**${cat.label}**\n\n${cat.commands.join('\n')}`,
    flags: 64,
  };
}

const STOCK_TIERS = [
  { label: '📗 STABLE',  range: 'barely moves. reliable like a good cow.',       tickers: ['MILK', 'CREM', 'SKIM', 'LACT'] },
  { label: '📙 MEDIUM',  range: 'some risk. some reward. mostly chaos.',          tickers: ['BUTR', 'WHEY', 'MOO', 'CURDS'] },
  { label: '📕 HIGH',    range: 'volatile. not for the lactose intolerant.',      tickers: ['CHUG', 'GOT', 'FETA'] },
  { label: '💀 CHAOTIC', range: 'anything goes. godspeed. 🥛',                   tickers: ['SPOIL', 'MOLD', 'FROTH'] },
];

function buildStockBoardText() {
  // Renders the stock board as an embed (description has 4096-char limit;
  // plain content caps at 2000 and the sparklines + stats push 14 tickers
  // past that limit).
  const prices = getPrices();

  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines = [
    '*real prices. fake money. actual consequences.*',
    '',
    '💸 Trade in **#milkbot-stocks** with `/b` `/s` `/port`',
    '📦 or just stare at the numbers and spiral quietly.',
  ];

  for (const tier of STOCK_TIERS) {
    lines.push('');
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`${tier.label}  *${tier.range}*`);
    lines.push('');
    for (const ticker of tier.tickers) {
      const s = STOCK_MAP[ticker];
      if (!s) continue;
      const { price, lastChange } = prices[ticker] || { price: 0, lastChange: 0 };
      const pct = (lastChange * 100).toFixed(1);
      const arrow = lastChange >= 0 ? '🟢' : '🔴';
      const sign = lastChange >= 0 ? '+' : '';
      const stats = getStats(ticker);
      const statsText = stats
        ? `High **${stats.high}** • Low **${stats.low}** • Avg **${stats.avg}**`
        : '*not enough data yet*';
      const sparkline = buildSparkline(getRecentHistory(ticker, 20));
      lines.push(`${arrow} **${ticker}** — ${s.name}`);
      lines.push(`> ${price} 🥛  *(${sign}${pct}%)*  \`${sparkline}\``);
      lines.push(`> 7-day: ${statsText}`);
      lines.push('');
    }
  }

  let description = lines.join('\n');
  // Embed description caps at 4096; safety trim.
  if (description.length > 4000) description = description.slice(0, 4000) + '\n*…truncated*';

  const embed = new EmbedBuilder()
    .setColor(0xF3E5AB)
    .setTitle('🥛 THE MILK MARKET IS OPEN 🥛')
    .setDescription(description)
    .setFooter({ text: `refreshed: ${now} EST 🥛` });
  // content: '' clears any legacy text when we're editing the old content-only message.
  return { content: '', embeds: [embed] };
}

function buildLeaderboardText(guild) {
  const balances = getData(balancesPath);
  const xpData = getData(xpPath);
  const bigTrades = getData(bigTradesPath);
  const medals = ['👑', '🥈', '🥉'];

  const { getPrices, getPortfolios } = require('./stockdata');
  const prices = getPrices();
  const portfolios = getPortfolios();

  const milkLordId = getMilkLordId(guild);

  const mbSorted = Object.entries(balances).sort(([, a], [, b]) => b - a).slice(0, 10);
  const mbLines = mbSorted.length === 0
    ? ['No milk bucks earned yet.']
    : mbSorted.map(([userId, balance], i) => {
        const member = guild.members.cache.get(userId);
        const name = member ? member.displayName : 'Unknown';
        const medal = medals[i] ?? `${i + 1}.`;
        const lordTag = userId === milkLordId ? ' 👑 **MilkLord**' : '';
        return `${medal} **${name}**${lordTag} — ${balance.toLocaleString()} milk bucks`;
      });

  const xpSorted = Object.entries(xpData).sort(([, a], [, b]) => b - a).slice(0, 10);
  const xpLines = xpSorted.length === 0
    ? ['No XP earned yet.']
    : xpSorted.map(([userId, totalXp], i) => {
        const member = guild.members.cache.get(userId);
        const name = member ? member.displayName : 'Unknown';
        const level = getLevel(totalXp);
        const rank = getRank(level);
        const medal = medals[i] ?? `${i + 1}.`;
        const p = prestige.getPrestige(userId);
        const pTag = p > 0 ? ` ✦P${p}` : '';
        return `${medal} **${name}** — Lvl ${level} ${rank}${pTag} (${totalXp.toLocaleString()} XP)`;
      });

  // Biggest single trade
  const bigTradeSorted = Object.entries(bigTrades).sort(([, a], [, b]) => b - a).slice(0, 10);
  const bigTradeLines = bigTradeSorted.length === 0
    ? ['No trades recorded yet.']
    : bigTradeSorted.map(([userId, amount], i) => {
        const member = guild.members.cache.get(userId);
        const name = member ? member.displayName : 'Unknown';
        const medal = medals[i] ?? `${i + 1}.`;
        return `${medal} **${name}** — ${amount.toLocaleString()} milk bucks`;
      });

  // Most currently invested in the market
  const marketValues = {};
  for (const [userId, holdings] of Object.entries(portfolios)) {
    let total = 0;
    for (const [ticker, { shares }] of Object.entries(holdings)) {
      total += shares * (prices[ticker]?.price || 0);
    }
    if (total > 0) marketValues[userId] = total;
  }
  const marketSorted = Object.entries(marketValues).sort(([, a], [, b]) => b - a).slice(0, 10);
  const marketLines = marketSorted.length === 0
    ? ['Nobody is in the market right now.']
    : marketSorted.map(([userId, value], i) => {
        const member = guild.members.cache.get(userId);
        const name = member ? member.displayName : 'Unknown';
        const medal = medals[i] ?? `${i + 1}.`;
        return `${medal} **${name}** — ${value.toLocaleString()} milk bucks invested`;
      });

  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const jackpotAmt = jackpot.getJackpot().toLocaleString();

  return [
    `🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛`,
    ``,
    `# 🏆 MILK MONEY LEADERBOARD`,
    `*the dairy economy is ruthless. updated every 5 minutes.*`,
    ``,
    `🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛`,
    ``,
    `## 💰 RICHEST PLAYERS`,
    mbLines.join('\n'),
    '',
    `## ⭐ XP & RANK`,
    xpLines.join('\n'),
    '',
    `## 📊 BIGGEST SINGLE TRADE`,
    bigTradeLines.join('\n'),
    '',
    `## 📈 MOST IN THE MARKET`,
    marketLines.join('\n'),
    '',
    `🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛🥛`,
    ``,
    `🎰 **SERVER JACKPOT: ${jackpotAmt} milk bucks** — 0.1% chance on every win`,
    ``,
    `*${now} EST · type \`!g\` in #milkbot-games to play · get rich or go broke 🥛*`,
  ].join('\n');
}

let lbMessage = null;
let helpMessage = null;
let sbMessage = null;
let shopMessage = null;

async function findBotMessage(channel, client, { contentHint = null, embedTitle = null } = {}) {
  const fetched = await channel.messages.fetch({ limit: 50 });
  return fetched.find(m => {
    if (m.author.id !== client.user.id) return false;
    if (contentHint && m.content && m.content.startsWith(contentHint)) return true;
    if (embedTitle && m.embeds?.[0]?.title?.includes(embedTitle)) return true;
    // Legacy: if nothing was passed (old calls) accept any bot message.
    if (!contentHint && !embedTitle) return true;
    return false;
  }) ?? null;
}

async function updateOrPost(channel, client, payload, label) {
  const hints = {};
  if (typeof payload === 'string') hints.contentHint = payload.slice(0, 20);
  if (payload && typeof payload === 'object') {
    if (payload.content) hints.contentHint = payload.content.slice(0, 20);
    const firstEmbed = payload.embeds?.[0];
    const embedData = firstEmbed?.data || firstEmbed;
    if (embedData?.title) hints.embedTitle = embedData.title;
  }
  const existing = await findBotMessage(channel, client, hints);
  if (existing) {
    const updated = await existing.edit(payload).catch(() => null);
    if (updated) {
      console.log(`[display] ${label} updated`);
      return updated;
    }
    await existing.delete().catch(() => {});
    console.log(`[display] ${label} reposting (edit failed)`);
  }
  const sent = await channel.send(payload).catch(console.error);
  console.log(`[display] ${label} posted`);
  return sent;
}

async function initDisplays(client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.log('[display] Guild not found'); return; }

  const helpChannel = guild.channels.cache.find(c => c.name === 'milkbot-commands');
  if (!helpChannel) {
    console.log('[display] milkbot-commands channel not found');
  } else {
    helpMessage = await updateOrPost(helpChannel, client, buildHelpEmbed('public'), 'Help message');
  }

  const lbChannel = guild.channels.cache.find(c => c.name === 'milkbot-leaderboard');
  if (!lbChannel) {
    console.log('[display] milkbot-leaderboard channel not found');
  } else {
    lbMessage = await updateOrPost(lbChannel, client, buildLeaderboardText(guild), 'Leaderboard');
  }

  const sbChannel = guild.channels.cache.find(c => c.name === 'milkbot-stocks-info');
  if (!sbChannel) {
    console.log('[display] milkbot-stocks-info channel not found');
  } else {
    sbMessage = await updateOrPost(sbChannel, client, buildStockBoardText(), 'Stock board');
  }
}

async function refreshHelp(client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const helpChannel = guild.channels.cache.find(c => c.name === 'milkbot-commands');
  if (!helpChannel) return;
  const helpPayload = buildHelpEmbed('public');
  if (helpMessage) {
    const updated = await helpMessage.edit(helpPayload).catch(() => null);
    if (updated) return;
  }
  helpMessage = await helpChannel.send(helpPayload).catch(console.error);
}

async function refreshLeaderboard(client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const lbChannel = guild.channels.cache.find(c => c.name === 'milkbot-leaderboard');
  if (!lbChannel) return;
  const lbText = buildLeaderboardText(guild);
  if (lbMessage) {
    const updated = await lbMessage.edit(lbText).catch(() => null);
    if (updated) return;
  }
  lbMessage = await lbChannel.send(lbText).catch(console.error);
}

async function refreshStockBoard(client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const sbChannel = guild.channels.cache.find(c => c.name === 'milkbot-stocks-info');
  if (!sbChannel) return;
  const sbText = buildStockBoardText();
  if (sbMessage) {
    const updated = await sbMessage.edit(sbText).catch(() => null);
    if (updated) return;
  }
  sbMessage = await sbChannel.send(sbText).catch(console.error);
}

async function initShopDisplay(client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const shopChannel = guild.channels.cache.find(c => c.name === 'milkbot-shop');
  if (!shopChannel) { console.log('[display] milkbot-shop channel not found — create it first'); return; }
  const { buildShopBoardText } = require('./shop');
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_browse').setLabel('🛒  Browse Shop').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shop_inv').setLabel('🎒  My Inventory').setStyle(ButtonStyle.Secondary),
  );
  shopMessage = await updateOrPost(shopChannel, client, { content: buildShopBoardText(), components: [row] }, 'Shop board');
}

async function refreshShopBoard(client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const shopChannel = guild.channels.cache.find(c => c.name === 'milkbot-shop');
  if (!shopChannel) return;
  const { buildShopBoardText } = require('./shop');
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_browse').setLabel('🛒  Browse Shop').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shop_inv').setLabel('🎒  My Inventory').setStyle(ButtonStyle.Secondary),
  );
  const payload = { content: buildShopBoardText(), components: [row] };
  if (shopMessage) {
    const updated = await shopMessage.edit(payload).catch(() => null);
    if (updated) { shopMessage = updated; return; }
  }
  shopMessage = await shopChannel.send(payload).catch(console.error);
}

module.exports = { initDisplays, refreshHelp, refreshLeaderboard, refreshStockBoard, buildHelpEmbed, buildCategoryReply, initShopDisplay, refreshShopBoard };
