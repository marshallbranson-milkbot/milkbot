const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, 'data/balances.json');
const xpPath = path.join(__dirname, 'data/xp.json');
const bigTradesPath = path.join(__dirname, 'data/bigtrades.json');
const prestige = require('./prestige');
const { STOCK_DEFS, getPrices, getStats } = require('./stockdata');
const jackpot = require('./jackpot');
const GUILD_ID = '562076997979865118';
const STOCK_MAP = Object.fromEntries(STOCK_DEFS.map(s => [s.ticker, s]));
const { getMilkLordId } = require('./commands/milklord');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
  if (level >= 25) return 'Milk God';
  if (level >= 20) return 'Milk Legend';
  if (level >= 15) return 'Milk Hustler';
  if (level >= 10) return 'Milk Fiend';
  if (level >= 5) return 'Milk Drinker';
  return 'Milk Baby';
}

const HELP_TEXT = `🥛 **welcome to milkbot. get rich or go broke.**

━━━━━━━━━━━━━━━━━━━━━━
💰 **YOUR MILK BUCKS** *(#milkbot-games)*
━━━━━━━━━━━━━━━━━━━━━━
\`!bal\` — how broke are you right now
\`!xp\` — your XP, level, and rank
\`!prestige\` — reset at level 25 for a permanent XP+milk multiplier
\`!ach\` — view your achievements
\`!da\` — grab your daily milk bucks (streaks pay up to 300)
\`!cc\` — claim a crate drop before someone else does (500 milk bucks)

━━━━━━━━━━━━━━━━━━━━━━
🎮 **GAMES** *(#milkbot-games)*
━━━━━━━━━━━━━━━━━━━━━━
\`!cf @user amount\` — challenge someone to a coinflip
\`!a\` / \`!d\` — accept or decline a coinflip
\`!fh amount\` — flip against MilkBot directly (good luck)
\`!sc\` — unscramble the word (3/letter, rare words 10/letter)
\`!sl\` — spin the slots for 10 milk bucks
\`!mt\` — milk trivia, A/B/C, first right answer wins · 15 milk bucks
\`!tr\` — trivia crack, spin for 1 of 6 categories, A/B/C/D · 20 milk bucks
\`!geo\` — name the country from the flag · 25 milk bucks
\`!bl amount\` — blackjack vs MilkBot (min 25 · blackjack pays 3:2)
\`!ra amount\` — start a raid, crew joins with \`!j\`
\`!ro @user\` — rob someone. 25% chance it works. 2hr cooldown.
\`!rou amount red/black/number\` — roulette. colors pay 2x, numbers pay 35x
\`!lt tickets\` — buy lottery tickets (10 🥛 each). midnight drawing. one winner takes it all.
\`!give @user amount\` — send milk bucks to another player
\`!pl amount\` — plinko. drop the ball. 10x edges, 0.3x middle. (min 10)
\`!bjt buy-in\` — blackjack tournament. 30s join window, everyone vs dealer, winners take 2x. (min 50)

━━━━━━━━━━━━━━━━━━━━━━
📈 **MILK STOCK MARKET** *(#milkbot-stocks · updates every 5 min)*
━━━━━━━━━━━━━━━━━━━━━━
📊 Live prices + 7-day stats → **#milkbot-stocks-info**
\`!b TICKER shares\` — buy shares
\`!ba TICKER\` — buy as many shares as you can afford
\`!s TICKER shares|all\` — dump shares
\`!port\` — view your portfolio (tap a stock to buy all or sell all)

*milk bucks. 🥛*`;

const STOCK_TIERS = [
  { label: '📗 STABLE',  range: '±2–5%/tick',   tickers: ['MILK', 'CREM', 'SKIM', 'LACT'] },
  { label: '📙 MEDIUM',  range: '±5–10%/tick',  tickers: ['BUTR', 'WHEY', 'MOO', 'CURDS'] },
  { label: '📕 HIGH',    range: '±10–20%/tick', tickers: ['CHUG', 'GOT', 'FETA'] },
  { label: '💀 CHAOTIC', range: '±5–30%/tick',  tickers: ['SPOIL', 'MOLD', 'FROTH'] },
];

function buildStockBoardText() {
  const prices = getPrices();

  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const lines = [
    '📊 **MILK STOCK MARKET** — live prices + 7-day stats',
    '📈 Buy/sell in **#milkbot-stocks** with `!b` `!s` `!port`',
    '',
  ];

  for (const tier of STOCK_TIERS) {
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

      lines.push(`${arrow} **${ticker}** — ${s.name}`);
      lines.push(`> ${price} 🥛  *(${sign}${pct}%)*  |  7-day: ${statsText}`);
      lines.push('');
    }
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`🎰 **SERVER JACKPOT: ${jackpot.getJackpot().toLocaleString()} milk bucks** — win any game for a 0.1% chance to claim it all`);
  lines.push('');
  lines.push(`*refreshed: ${now} EST 🥛*`);
  return lines.join('\n');
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

  return [
    '🥛 **who\'s got the most milk bucks. updated live.**',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '💰 **MILK BUCKS STANDINGS**',
    '━━━━━━━━━━━━━━━━━━━━━━',
    mbLines.join('\n'),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '⭐ **XP & RANK STANDINGS**',
    '━━━━━━━━━━━━━━━━━━━━━━',
    xpLines.join('\n'),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '📊 **BIGGEST SINGLE TRADE**',
    '━━━━━━━━━━━━━━━━━━━━━━',
    bigTradeLines.join('\n'),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '📈 **MOST IN THE MARKET**',
    '━━━━━━━━━━━━━━━━━━━━━━',
    marketLines.join('\n'),
    '',
    `*refreshed: ${now} EST — play games to climb. 🥛*`
  ].join('\n');
}

let lbMessage = null;
let helpMessage = null;
let sbMessage = null;

async function findBotMessage(channel, client) {
  const fetched = await channel.messages.fetch({ limit: 20 });
  return fetched.find(m => m.author.id === client.user.id) ?? null;
}

async function initDisplays(client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.log('[display] Guild not found'); return; }

  const helpChannel = guild.channels.cache.find(c => c.name === 'milkbot-commands');
  if (!helpChannel) {
    console.log('[display] milkbot-commands channel not found');
  } else {
    const existing = await findBotMessage(helpChannel, client);
    if (existing) {
      helpMessage = await existing.edit(HELP_TEXT).catch(console.error);
      console.log('[display] Help message updated');
    } else {
      helpMessage = await helpChannel.send(HELP_TEXT).catch(console.error);
      console.log('[display] Help message posted');
    }
  }

  const lbChannel = guild.channels.cache.find(c => c.name === 'milkbot-leaderboard');
  if (!lbChannel) {
    console.log('[display] milkbot-leaderboard channel not found');
  } else {
    const lbText = buildLeaderboardText(guild);
    const existing = await findBotMessage(lbChannel, client);
    if (existing) {
      lbMessage = await existing.edit(lbText).catch(console.error);
      console.log('[display] Leaderboard updated');
    } else {
      lbMessage = await lbChannel.send(lbText).catch(console.error);
      console.log('[display] Leaderboard posted');
    }
  }

  const sbChannel = guild.channels.cache.find(c => c.name === 'milkbot-stocks-info');
  if (!sbChannel) {
    console.log('[display] milkbot-stocks-info channel not found');
  } else {
    const sbText = buildStockBoardText();
    const existing = await findBotMessage(sbChannel, client);
    if (existing) {
      sbMessage = await existing.edit(sbText).catch(console.error);
      console.log('[display] Stock board updated');
    } else {
      sbMessage = await sbChannel.send(sbText).catch(console.error);
      console.log('[display] Stock board posted');
    }
  }
}

async function refreshHelp(client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const helpChannel = guild.channels.cache.find(c => c.name === 'milkbot-commands');
  if (!helpChannel) return;
  if (helpMessage) {
    const updated = await helpMessage.edit(HELP_TEXT).catch(() => null);
    if (updated) return;
  }
  helpMessage = await helpChannel.send(HELP_TEXT).catch(console.error);
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

module.exports = { initDisplays, refreshHelp, refreshLeaderboard, refreshStockBoard, HELP_TEXT };
