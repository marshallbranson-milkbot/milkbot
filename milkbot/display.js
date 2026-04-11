const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, 'data/balances.json');
const xpPath = path.join(__dirname, 'data/xp.json');
const bigTradesPath = path.join(__dirname, 'data/bigtrades.json');
const GUILD_ID = '562076997979865118';

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
\`!ach\` — view your achievements
\`!da\` — grab your daily milk bucks (streaks pay up to 300)
\`!cc\` — claim a crate drop before someone else does (500 milk bucks)

━━━━━━━━━━━━━━━━━━━━━━
🎮 **GAMES** *(#milkbot-games)*
━━━━━━━━━━━━━━━━━━━━━━
\`!cf @user amount\` — challenge someone to a coinflip
\`!a\` / \`!d\` — accept or decline a coinflip
\`!fh amount\` — flip against MilkBot directly (good luck)
\`!g\` — guess 1-100, closest in 15s wins 5 milk bucks (solo: must be within 10)
\`!sc\` — unscramble the word (3/letter, rare words 10/letter)
\`!sl\` — spin the slots for 10 milk bucks
\`!mt\` — milk trivia, A/B/C, first right answer wins · 15 milk bucks
\`!tr\` — trivia crack, spin for 1 of 6 categories, A/B/C/D · 20 milk bucks
\`!geo\` — name the country from the flag · 25 milk bucks
\`!bl amount\` — blackjack vs MilkBot (min 25 · blackjack pays 3:2)
\`!ra amount\` — start a raid, crew joins with \`!j\`
\`!ro @user\` — rob someone. 25% chance it works. 2hr cooldown.

━━━━━━━━━━━━━━━━━━━━━━
📈 **MILK STOCK MARKET** *(#milkbot-stocks · updates every 5 min)*
━━━━━━━━━━━━━━━━━━━━━━
\`!st\` — check current prices
\`!b TICKER shares\` — buy shares
\`!s TICKER shares|all\` — dump shares
\`!port\` — view your portfolio

\`MILK\` MilkCorp Industries — Stable ±2-5%
\`CREM\` Creme Capital — Stable ±2-5%
\`BUTR\` ButterCo Holdings — Medium ±5-10%
\`WHEY\` Whey Street Group — Medium ±5-10%
\`MOO\` Moo Markets Inc — Medium ±5-10%
\`CHUG\` Chug Enterprises — Volatile ±10-20%
\`GOT\` Got Milk Global — Volatile ±10-20%
\`SPOIL\` Spoiled Rotten LLC — Chaotic ±5-30%

*milk bucks. 🥛*`;

function buildLeaderboardText(guild) {
  const balances = getData(balancesPath);
  const xpData = getData(xpPath);
  const bigTrades = getData(bigTradesPath);
  const medals = ['👑', '🥈', '🥉'];

  const { getPrices, getPortfolios } = require('./stockdata');
  const prices = getPrices();
  const portfolios = getPortfolios();

  const mbSorted = Object.entries(balances).sort(([, a], [, b]) => b - a).slice(0, 10);
  const mbLines = mbSorted.length === 0
    ? ['No milk bucks earned yet.']
    : mbSorted.map(([userId, balance], i) => {
        const member = guild.members.cache.get(userId);
        const name = member ? member.displayName : 'Unknown';
        const medal = medals[i] ?? `${i + 1}.`;
        return `${medal} **${name}** — ${balance.toLocaleString()} milk bucks`;
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
        return `${medal} **${name}** — Lvl ${level} ${rank} (${totalXp.toLocaleString()} XP)`;
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

module.exports = { initDisplays, refreshHelp, refreshLeaderboard, HELP_TEXT };
