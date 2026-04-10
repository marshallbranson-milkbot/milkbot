const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, 'data/balances.json');
const xpPath = path.join(__dirname, 'data/xp.json');
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

const HELP_TEXT = `**MilkBot Commands** 🥛

**Currency** *(use in #milkbot-games)*
\`!bal\` — Check your milk bucks balance
\`!xp\` — Check your XP, level, and rank
\`!da\` — Claim your daily milk bucks (streak bonuses up to 300)
\`!cc\` — Claim an active milk crate drop (500 milk bucks, first come first served)

**Games** *(use in #milkbot-games)*
\`!cf @user amount\` — Challenge someone to a coinflip
\`!a\` / \`!d\` — Accept or decline a coinflip challenge
\`!fh amount\` — Flip against MilkBot directly
\`!g\` — Start a number guessing game (daily cooldown)
\`!sc\` — Unscramble a word to win milk bucks
\`!sl\` — Spin the slots for 10 milk bucks (30s cooldown)
\`!mt\` — Milk trivia (A/B/C, first correct wins 15 milk bucks)
\`!geo\` — Guess the country from the flag (30s, 50 milk bucks)
\`!ra amount\` — Start a raid, others join with \`!j\` (60s window)
\`!ro @user\` — Rob someone (33% success, 2hr cooldown)

**Milk Stock Market** 📈 *(use in #milkbot-stocks)*
\`!st\` — View current stock prices
\`!buy TICKER amount\` — Buy shares in a stock
\`!sell TICKER amount|all\` — Sell shares
\`!port\` — View your portfolio

**Stocks & Volatility**
\`MILK\` MilkCorp Industries — Stable (±2-5%)
\`CREM\` Creme Capital — Stable (±2-5%)
\`BUTR\` ButterCo Holdings — Medium (±5-10%)
\`WHEY\` Whey Street Group — Medium (±5-10%)
\`MOO\` Moo Markets Inc — Medium (±5-10%)
\`CHUG\` Chug Enterprises — Volatile (±10-20%)
\`GOT\` Got Milk Global — Volatile (±10-20%)
\`SPOIL\` Spoiled Rotten LLC — Chaotic (±5-30%)`;

function buildLeaderboardText(guild) {
  const balances = getData(balancesPath);
  const xpData = getData(xpPath);
  const medals = ['👑', '🥈', '🥉'];

  const mbSorted = Object.entries(balances).sort(([, a], [, b]) => b - a);
  const mbLines = mbSorted.length === 0
    ? ['No milk bucks earned yet.']
    : mbSorted.map(([userId, balance], i) => {
        const member = guild.members.cache.get(userId);
        const name = member ? member.displayName : 'Unknown';
        const medal = medals[i] ?? `${i + 1}.`;
        return `${medal} **${name}** — ${balance.toLocaleString()} milk bucks`;
      });

  const xpSorted = Object.entries(xpData).sort(([, a], [, b]) => b - a);
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

  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return [
    '**Milk Bucks Leaderboard** 🥛',
    mbLines.join('\n'),
    '',
    '**XP Leaderboard** ⭐',
    xpLines.join('\n'),
    '',
    `*Last updated: ${now} EST*`
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
  if (!helpMessage) return;
  await helpMessage.edit(HELP_TEXT).catch(console.error);
}

async function refreshLeaderboard(client) {
  if (!lbMessage) return;
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const lbText = buildLeaderboardText(guild);
  await lbMessage.edit(lbText).catch(console.error);
}

module.exports = { initDisplays, refreshHelp, refreshLeaderboard, HELP_TEXT };
