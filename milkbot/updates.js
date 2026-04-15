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
    id: 'v10-stocks-games-cleanup',
    text: [
      `📈 **6 new stocks + 2 new games**`,
      ``,
      `**New stocks on the market:**`,
      `• \`SKIM\` — Skim Street Capital *(stable)*`,
      `• \`LACT\` — Lactose Capital *(stable)*`,
      `• \`CURDS\` — CurdCo Ventures *(medium)*`,
      `• \`FETA\` — Feta Financial *(volatile)*`,
      `• \`MOLD\` — Moldy Money LLC *(chaotic)*`,
      `• \`FROTH\` — Frothy Futures LLC *(chaotic)*`,
      `All 14 stocks now live in \`#milkbot-stocks-info\` with their own Moo News headlines.`,
      ``,
      `**New games in \`#milkbot-games\`:**`,
      `• \`!rou <amount> <red|black|0-36>\` — Roulette. Colors pay 2x, numbers pay 35x. Min 10 milk bucks.`,
      `• \`!lt <tickets>\` — Daily Lottery. 10 milk bucks per ticket, no cap. One winner drawn at midnight. Pot rolls over from every ticket sold.`,
      ``,
      `**Removed:** \`!g\` (guess the number) — nobody played it, into the trash it goes 🗑️`,
      ``,
      `**Fixed:** Moo News drops no longer vanish when the bot restarts — schedule is now saved and survives redeploys. 🥛`,
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
