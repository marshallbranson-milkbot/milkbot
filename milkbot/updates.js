const fs = require('fs');
const path = require('path');

const GUILD_ID = '562076997979865118';
const postedPath = path.join(__dirname, 'data/updates_posted.json');

// ─── UPDATE LOG ─────────────────────────────────────────────────────────────
// Add new entries to the BOTTOM of this list.
// Each entry is posted once and never again. ids must be unique.

const UPDATES = [
  {
    id: 'v1-launch',
    text: [
      `🚀 **MilkBot launches**`,
      `Core currency system goes live. \`!bal\`, \`!da\` daily rewards with streak bonuses, \`!cf\` coinflip, \`!fh\` flip the house, \`!sl\` slots, \`!g\` guess the number, \`!sc\` scramble, \`!mt\` milk trivia, \`!geo\` flag quiz, \`!bl\` blackjack. The dairy economy begins.`,
    ].join('\n'),
  },
  {
    id: 'v2-milklord',
    text: [
      `👑 **Milk Lord**`,
      `The richest player earns the Milk Lord role at midnight every day. Bragging rights. Nothing else. That's enough.`,
    ].join('\n'),
  },
  {
    id: 'v3-xp',
    text: [
      `⭐ **XP & leveling system**`,
      `Earn XP through game wins. Six ranks: Milk Baby → Milk Drinker → Milk Fiend → Milk Hustler → Milk Legend → Milk God. Check progress with \`!xp\`.`,
    ].join('\n'),
  },
  {
    id: 'v4-leaderboard',
    text: [
      `🏆 **Live leaderboard**`,
      `Auto-updating leaderboard in \`#milkbot-leaderboard\`. All players ranked by milk bucks, refreshes every 5 minutes and after every win.`,
    ].join('\n'),
  },
  {
    id: 'v5-raid-rob',
    text: [
      `⚔️ **Raid & Rob**`,
      `\`!ra\` — start a group raid. Others \`!j\` to join within 15 seconds. Winner takes the pot. \`!ro\` — 25% chance to steal from the server, 2hr cooldown. High risk dairy crime.`,
    ].join('\n'),
  },
  {
    id: 'v6-doublexp',
    text: [
      `⚡ **Double XP events**`,
      `Every day at noon and 8 PM EST, a 1-hour double XP window kicks off. All XP gains doubled. Stack it with a hot streak for maximum dairy gains.`,
    ].join('\n'),
  },
  {
    id: 'v7-hotstreak',
    text: [
      `🔥 **Hot streak multiplier**`,
      `Win 3 games in a row and all milk bucks and XP gains are multiplied by 1.5x until you lose. The server gets notified. Don't blow it.`,
    ].join('\n'),
  },
  {
    id: 'v8-crates',
    text: [
      `📦 **Crate drops**`,
      `3–5 random crate drops per day. First to type \`!cc\` in \`#milkbot-games\` claims 500 milk bucks. 30 minute window. Expires unclaimed if nobody moves.`,
    ].join('\n'),
  },
  {
    id: 'v9-stocks',
    text: [
      `📈 **Milk stock market**`,
      `8 dairy stocks: MILK, CREM, BUTR, WHEY, MOO, CHUG, GOT, SPOIL. Prices update every 5 minutes. \`!st\` to check prices, \`!b\` to buy, \`!s\` to sell, \`!port\` to view your portfolio. Earn XP on profitable sells.`,
    ].join('\n'),
  },
  {
    id: 'v10-moo-news',
    text: [
      `📰 **Moo News**`,
      `300 headlines. 6–9 market-moving news drops per day in \`#milkbot-stocks\`. Headlines affect stock prices on the next tick. Occasionally a random player gets a private insider tip before the news drops.`,
    ].join('\n'),
  },
  {
    id: 'v11-prestige',
    text: [
      `🌟 **Prestige system**`,
      `Hit the milk buck ceiling? Prestige to reset your balance and earn a permanent multiplier on all future winnings and XP. The grind never ends.`,
    ].join('\n'),
  },
  {
    id: 'v12-bj-split-double',
    text: [
      `🃏 **Blackjack: double down & split**`,
      `Two new blackjack moves. \`double\` — double your bet, take exactly one card, stand automatically. \`split\` — split matching cards into two separate hands, play each one out. Double down available on the opening two cards of any split hand.`,
    ].join('\n'),
  },
  {
    id: 'v13-geo-rework',
    text: [
      `🌍 **Geo Guesser rework**`,
      `\`!geo\` is now a real image-based geography game. Bot posts a photo of a real-world location — type the country name to win 50 milk bucks. Continent hint drops at 15 seconds. 100 locations across every continent.`,
    ].join('\n'),
  },
  {
    id: 'v14-new-stocks',
    text: [
      `📈 **6 new stocks**`,
      `The market just got bigger. SKIM (Skim Street Capital), LACT (Lactose Capital), CURDS (CurdCo Ventures), FETA (Feta Financial), MOLD (Moldy Money LLC), and FROTH (Frothy Futures LLC) are now live. 14 stocks total. All with their own Moo News headlines. \`#milkbot-stocks-info\` has been updated.`,
    ].join('\n'),
  },
  {
    id: 'v15-roulette',
    text: [
      `🎡 **Roulette**`,
      `\`!rou <amount> <red|black|0-36>\` — spin the wheel. Bet on red or black to double your money, or pick a specific number for a 35x payout. Min 10 milk bucks. Hot streak and prestige multipliers apply.`,
    ].join('\n'),
  },
  {
    id: 'v16-lottery',
    text: [
      `🎟️ **Daily Lottery**`,
      `\`!lt <tickets>\` — buy as many tickets as you want at 10 milk bucks each. One winner drawn at midnight. Every ticket in the pot goes straight to the prize. More tickets, better odds. Nobody buys in? The pot sits there judging everyone.`,
    ].join('\n'),
  },
  {
    id: 'v17-give',
    text: [
      `💸 **!give**`,
      `\`!give @user amount\` — send milk bucks directly to another player. No fees, no catches. Use it for kindness, bribes, or deeply suspicious generosity.`,
    ].join('\n'),
  },
  {
    id: 'v18-dividends',
    text: [
      `💰 **Dividends**`,
      `Holding stocks now pays out. Every 5 minutes, stable stocks (MILK, CREM, SKIM, LACT) pay 5%/day, mid-tier stocks pay 3%/day, and volatile ones pay 1%/day. Passive income, silent and automatic. Check \`!bal\` to see it building up.`,
    ].join('\n'),
  },
  {
    id: 'v19-plinko',
    text: [
      `🪣 **Plinko**`,
      `\`!pl <amount>\` — drop the ball through 6 rows. It ends up in one of 7 slots: 10x on the edges, 3x one in, 1x breakeven, and 0.3x in the middle. The board animates live. Min 10 milk bucks.`,
    ].join('\n'),
  },
  {
    id: 'v20-bjt',
    text: [
      `🃏 **Blackjack Tournament**`,
      `\`!bjt <buy-in>\` — host a blackjack tournament. Everyone has 30 seconds to join with \`!j\`. Once it kicks off, each player is dealt a hand and plays against the dealer one at a time (20 seconds per turn). Beat the dealer, win 2x your buy-in. Min 50 milk bucks.`,
    ].join('\n'),
  },
  {
    id: 'v21-rework',
    text: [`🥛 **MILKBOT REWORK — PATCH NOTES** 🥛`].join('\n'),
  },
  {
    id: 'v22-game-menu-2',
    text: [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🎮 **THE MILKBOT OVERHAUL** 🎮`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🕹️ **GAME MENU** — \`!g\` is now the **only command you need** in #milkbot-games.`,
      `One button menu. Pick a category — Casino, Cards, Social, Wallet. Click the game. Play it. No more typing commands.`,
      `Games that need a bet prompt you. Games that need a @user prompt you. Everything is clickable.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🪣 **PLINKO REBALANCED** — Bigger board (9 slots). Edges dropped from 10x to 5x. Center is now 0.2x. The house always drinks.`,
      ``,
      `📈 **XP OVERHAUL** — XP is now flat per game. No more scaling with bet size. Hard cap of 200 XP per win. Big bets don't shortcut the grind anymore.`,
      ``,
      `⛔ **CAPS** — Level hard stops at **25**. Prestige maxes at **5**. That's the ceiling. Prestige to reset and climb again.`,
      ``,
      `📊 **PORTFOLIO UPGRADE** — \`!port\` → select a stock → **4 buttons**: Buy All · Sell All · Buy Amount · Sell Amount.`,
      ``,
      `👑 **MILK LORD** — The richest player now gets crowned everywhere. Win a game as Milk Lord and everyone knows it.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*— MilkBot Management. type \`!g\` and get to work. 🥛*`,
    ].join('\n'),
  },
  {
    id: 'v23-raidboss-2',
    text: [
      `🐄 **NIGHTLY RAID BOSS**`,
      `Every night at midnight EST, a milk-themed monster appears in **#milkbot-games** with **5,000 HP**.`,
      `Click **⚔️ Attack** on the boss message. Once per hour. Damage scales with your level. Risk: 15% chance you lose some milk bucks per attack.`,
      `If the server defeats it before the next midnight — **60 🥛 per attack**, multiplied by your prestige level.`,
      `If it escapes — **20 🥛 per attack**, no multiplier.`,
      `7 rotating bosses. 🥛`,
    ].join('\n'),
  },
];

// ─── LOGIC ──────────────────────────────────────────────────────────────────

function getPosted() {
  if (!fs.existsSync(postedPath)) return [];
  try { return JSON.parse(fs.readFileSync(postedPath, 'utf8')); } catch { return []; }
}

function savePosted(ids) {
  fs.writeFileSync(postedPath, JSON.stringify(ids));
}

async function postUpdates(client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  const channel = guild?.channels.cache.find(c => c.name === 'milkbot-updates');
  if (!channel) return; // channel doesn't exist yet, skip silently

  const posted = getPosted();
  const toPost = UPDATES.filter(u => !posted.includes(u.id));
  if (toPost.length === 0) return;

  for (const update of toPost) {
    await channel.send(update.text).catch(console.error);
    posted.push(update.id);
    savePosted(posted);
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`[updates] posted ${toPost.length} update(s)`);
}

module.exports = { postUpdates };
