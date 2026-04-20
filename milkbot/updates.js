const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const GUILD_ID = '562076997979865118';
const postedPath = path.join(__dirname, 'data/updates_posted.json');

// Discord content cap is 2000 chars. Long patch notes would get rejected, so
// any update over this threshold posts as an embed (description cap 4096).
// Short updates keep the plain-content format they've always used.
const CONTENT_SAFE_LIMIT = 1900;

function buildUpdatePayload(text) {
  if (text.length <= CONTENT_SAFE_LIMIT) return text;
  // Extract a title from the first bold header, fall back to generic.
  const headerMatch = text.match(/\*\*([^*]+)\*\*/);
  const title = headerMatch ? headerMatch[1].trim() : '🥛 MilkBot Patch 🥛';
  const embed = new EmbedBuilder()
    .setColor(0xF3E5AB)
    .setTitle(`🥛 ${title} 🥛`)
    .setDescription(text.length > 4000 ? text.slice(0, 4000) + '\n*…truncated*' : text);
  return { embeds: [embed] };
}

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
      `Every night at midnight EST, a milk-themed monster appears in **#milkbot-games** with **25,000 HP**.`,
      `Click **⚔️ Attack** on the boss message. Once per 5 minutes. Damage scales with your level. Risk: 15% chance you lose some milk bucks per attack.`,
      `If the server defeats it before the next midnight — **60 🥛 per attack**, multiplied by your prestige level.`,
      `If it escapes — **20 🥛 per attack**, no multiplier.`,
      `31 rotating bosses — all Destiny raid-inspired, all milky. 🥛`,
    ].join('\n'),
  },
  {
    id: 'v24-overhaul',
    text: [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🥛 **MILKBOT PATCH — BIG ONE** 🥛`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🕹️ **SLASH COMMANDS** — Everything works with \`/\` now. \`/g\`, \`/b\`, \`/s\`, \`/ba\`, \`/port\`, \`/bal\`, \`/h\` — type \`/\` and Discord autocompletes it. The \`!\` prefix still works too.`,
      ``,
      `👁 **PRIVATE MENUS** — \`/g\` now shows only to you. Nobody else sees your menu, your bet prompts, or your results. Fully invisible. Solo games stay between you and the bot. Use \`!g\` if you want the old public version.`,
      ``,
      `⭐ **LEVEL CAP: 100** — The cap has been raised from 25 to 100. New rank titles unlock every 10 levels:`,
      `\`Milk Baby → Milk Drinker → Milk Fiend → Milk Hustler → Milk Dealer → Milk Baron → Milk Legend → Milk Overlord → Milk God → Milk Eternal → THE ONE TRUE MOO\``,
      `Prestige 5 removes the cap entirely. Prestige now requires **level 100**.`,
      ``,
      `🐄 **RAID BOSS UPGRADE** — Boss art is now a full figure. Clicking **Boss** in the Social menu posts the full attack interface directly to the channel — no more scrolling up to find it.`,
      ``,
      `🧠 **CLEAN CO-OP GAMES** — Trivia, Scramble, Geo, and Trivia Crack now delete all answer messages instantly. No more 50 wrong guesses clogging the channel. Questions stay up for the full timer. Results auto-clean when the game ends.`,
      ``,
      `🃏 **BLACKJACK REBALANCED** — Dealer behavior is now randomized. The house edge is gone. Could go either way now.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*— MilkBot Management. the dairy evolves. 🥛*`,
    ].join('\n'),
  },
  {
    id: 'v25-destiny-overhaul',
    text: [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🥛 **MILKBOT PATCH — THE DAIRY RAID UPDATE** 🥛`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🎰 **MENU RESTRUCTURE** — Cards category is gone. Blackjack and Tournament moved into Casino. Main menu is now 3 categories: Casino · Social · Wallet. Cleaner, faster.`,
      ``,
      `👁️ **FULLY PRIVATE /g** — \`/g\` is completely invisible to everyone else. Menus, bet prompts, results — all only you see them. \`!g\` now redirects you to \`/g\`. There is no public version anymore.`,
      ``,
      `💨 **AUTO-CLEANUP** — Game results disappear after 15 seconds. Bet prompts vanish the moment you answer. Timed out? Gone in 5 seconds. Channel stays clean.`,
      ``,
      `🔒 **ONE GAME AT A TIME** — Can't spam-launch multiple games simultaneously. Finish what you started.`,
      ``,
      `🐄 **31 DESTINY RAID BOSSES** — All 7 original bosses replaced. 31 new bosses inspired by Destiny 1 & 2 raids — Crota, Oryx, Atheon, Calus, Riven, Rhulk, The Witness, and 24 more. All milky. All imposing.`,
      ``,
      `⚔️ **RAID BOSS REBALANCED** — Attack cooldown dropped to **5 minutes**. HP scaled up to **25,000**. More attacks, more chaos, real challenge.`,
      ``,
      `🥛 **MILKBOT CREW** — New role required to see MilkBot channels. New members get asked during onboarding. Existing members: click the opt-in button to lock in your access.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*— MilkBot Management. the raid never ends. 🥛*`,
    ].join('\n'),
  },
  {
    id: 'v27-stability',
    text: [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🥛 **MILKBOT PATCH — THE INTEGRITY UPDATE** 🥛`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🔒 **ECONOMY HARDENED** — Several holes in the economy have been patched. Balance limits are now enforced everywhere. The numbers mean something again.`,
      ``,
      `⚔️ **GAMES TIGHTENED** — Button spam, duplicate actions, and edge cases across Blackjack, Raid Boss, and the Casino have been locked down. Play fast, play clean.`,
      ``,
      `📉 **DIVIDENDS REMOVED** — Passive income from holding stocks is gone. The market is about buying low and selling high now. That's it.`,
      ``,
      `🛡️ **UNDER THE HOOD** — A full audit was run on every system. A lot was caught. A lot was fixed. The bot is cleaner than it's ever been.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*— MilkBot Management. the milk doesn't lie. 🥛*`,
    ].join('\n'),
  },
  {
    id: 'v28c-milk-market',
    text: [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🥛 **MILKBOT PATCH — THE MILK MARKET UPDATE** 🥛`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🏪 **THE MILK MARKET IS OPEN** — a new \`#milkbot-shop\` channel is live. 59 items across 4 tiers: Common, Uncommon, Rare, and Legendary. **10 fresh deals rotate every day at midnight EST.** Use \`/shop\` to browse or click the buttons in the shop channel.`,
      ``,
      `⚡ **SHOP BUFFS** — items you buy actually do things. Boost your earnings, stack XP multipliers, crank jackpot odds, double your daily reward, power up raid damage. Stack multiple buffs at once. The bonuses are additive. get disgusting.`,
      ``,
      `🛡️ **RAID SHIELDS** — negate boss counter-attacks entirely. buy one. stop bleeding milk every time you hit the boss. for a while, at least.`,
      ``,
      `☠️ **BOSS NUKE ITEMS** — Boss Plague Vial (800 HP) and The Dairy Plague (5,000 HP) deal instant server-wide damage. anyone who nukes it gets credit toward the kill reward.`,
      ``,
      `🗑️ **BUFF & ITEM MANAGEMENT** — you can now delete active buffs and discard inventory items you don't want. open \`/inv\` → **Remove Buff** to cancel any active buff early. click any inventory item → **Discard** to throw it out. no refunds. obviously.`,
      ``,
      `📦 **DAILY PURCHASE LIMITS** — the shop now has per-tier caps. Common: 10/day. Uncommon: 5/day. Rare: 3/day. Legendary: 1/day. resets at midnight EST with the shop rotation.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*— MilkBot Management. the dairy economy never sleeps. 🥛*`,
    ].join('\n'),
  },
  {
    id: 'v29-spoiled-vault',
    text: [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🥛 **MILKBOT PATCH — THE SPOILED VAULT** 🥛`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🏰 **MILKBOT DUNGEON IS LIVE** — \`#milkbot-dungeon\` is open. Up to 4 players, 1,000 🥛 entry, 10 floors of curdled horrors. Private thread per run. Real turn-based combat. Real loot. Real death. Come back rich or don't come back.`,
      ``,
      `🎭 **4 CLASSES** — 🥛 Creamlord (tank), ⚔️ Whey Reaver (dps), 💉 Curd Medic (unlock: clear floor 5), ✨ Lactic Mage (unlock: beat the Curdfather). Each plays different. Each has a job.`,
      ``,
      `👹 **8 ENEMIES + 2 BOSSES** — the **Lactose Lich** sits on floor 5 with a phase shift. **The Curdfather** waits at the bottom with 3 phases, summons, and a grudge.`,
      ``,
      `🎲 **EVERY RUN IS DIFFERENT** — 6 room types: combat, elite, treasure, 15 choose-your-own events, merchant, rest. Procedural. Chaotic. Milky.`,
      ``,
      `🏺 **10 RELICS + 6 CONSUMABLES** — persistent run-long buffs. Drop from elites, bosses, chests, shrines. Stack them. Run them up.`,
      ``,
      `🔥 **DEATH IS CHEAP BUT NOT FREE** — 0 HP = Curdled. teammates can revive. party wipe ends the run. survive = split the pot, grab the XP, keep the relics.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `💰 **WALLET CAP → 1 BILLION 🥛** — the ceiling keeps moving. keep stacking.`,
      ``,
      `🛒 **25+ NEW SHOP ITEMS** across Dungeon and PvP lanes. Two brand new mechanics:`,
      `🛡️ **Rob Shields** — Rob Decoy, Milk Armor, Iron Piggy Bank, **Fort Knox Milk** (7-day immunity). Blocks incoming rob attempts outright.`,
      `💰 **Rob Boosts** — Thief's Mask, Pickpocket Gloves, Thief Lord's Crown, **The Heist Code** (+500% on one single rob). Multiplies what you steal.`,
      ``,
      `🃏 **BLACKJACK AUTO-CLEAN** — completed games vanish after **8 seconds**. \`#milkbot-games\` stays tight.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*— MilkBot Management. the vault is open. go get rich or get curdled. 🥛*`,
    ].join('\n'),
  },
  {
    id: 'v32-creamspire-cosmos',
    text: [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🥛 **MILKBOT PATCH — THE CREAMSPIRE COSMOS** 🥛`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🌌 **THIRD DUNGEON — THE CREAMSPIRE COSMOS** — stacks BELOW the Udder Abyss in \`#milkbot-dungeon\`. Ascend from ancient cheese crypts through cloud kingdoms into literal cosmic space. 10 floors. 8 new enemies (Aged Warden, Rind Crawler, Fossilized Calf, Cream Paladin, Cloud Calf, Halo Wraith, Starlight Yak, Nebula Wisp) + 2 bosses: **Lord Parmigiano** (floor 5) and **Mother Galaxy** (floor 10 — 4 phases, summons weakened Curdfather + Udder God as callbacks). Unlock it by beating the Udder God.`,
      ``,
      `🎭 **2 NEW CLASSES**`,
      `🎵 **Cream Bard** — support/buffer. Rally Song, Curdcall, Anthem of the Herd. Unlocks by beating Lord Parmigiano.`,
      `🐄 **Herder** — beastmaster. Sic 'Em, Guard Bond, Stampede. Unlocks by beating Mother Galaxy.`,
      ``,
      `💎 **NEW RELICS** — 10 regular + 4 mythic Creamspire relics. Mythics are divine-scale: **Halo of Cream** (revive the whole party on wipe), **Cosmic Ledger** (pot doubles on victory), **Milkgod's Tear** (first hit every combat is a guaranteed 5× crit), **The First Drop** (+50% party stats; pot halved). Hardcore runs only.`,
      ``,
      `🔧 **MASSIVE STABILITY PASS**`,
      `• Class picker no longer crashes with 6+ classes (Discord row-limit fix)`,
      `• Unblockable damage no longer turns HP into NaN (Milkmaid Ghost bug)`,
      `• Stalled boss fights — turn loop now skips invalid actors instead of halting`,
      `• Runs with NaN / null HP auto-repair on boot`,
      `• Ability buttons no longer grey out spuriously from edge-case \`undefined\``,
      `• Revive Tokens now target downed allies instead of fizzling on yourself`,
      `• Floor-cleared message no longer off-by-one`,
      `• Classes unlocked via completion are now actually clickable in the picker (was the "I beat it but the class is locked" bug)`,
      `• Stock board no longer crashes the bot on boot (2000-char content limit bypassed via embed)`,
      ``,
      `🗺️ **DUNGEON CHANNEL POLISH** — three stacked panels (Vault → Abyss → Creamspire), explainer always at the top, stats row always at the bottom. Misorder detection wipes and re-posts if anything drifts out of place.`,
      ``,
      `⚙️ **UNDER THE HOOD** — dungeon unlock gates and class unlocks are now data-table driven (\`unlocks.js\`). Per-dungeon completion tracking. Bot auto-resumes your mid-combat turn after a restart — no more "click your button" ghost prompts.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*— MilkBot Management. three dungeons. eight classes. the spire is open. climb. 🥛*`,
    ].join('\n'),
  },
  {
    id: 'v31-big-expansion',
    text: [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🥛 **MILKBOT PATCH — THE BIG ONE** 🥛`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🕳️ **THE UDDER ABYSS** — a second dungeon lives BELOW the Spoiled Vault in \`#milkbot-dungeon\`. 10 more floors. 8 new enemies. 2 new bosses: **The Great Maw** (floor 5) and **The Udder God** (floor 10 — 4 phases). Unlock it by beating the Curdfather.`,
      ``,
      `🎭 **2 NEW CLASSES**`,
      `🫧 **Frothmancer** — summoner. Unlocks by clearing Udder Abyss floor 5.`,
      `🛡️ **Whey Warden** — counter-attacker. Unlocks by beating the Udder God.`,
      ``,
      `⚡ **CLASS MASTERY** — every class now has a 3rd ability, locked behind completing a dungeon run as that class. Creamlord gets Milk Fortress. Whey Reaver gets Blood Mist. Medic gets Mass Transfusion. Mage gets Curdstorm. Warden gets Untouchable. Earn them.`,
      ``,
      `💀 **HARDCORE MODE** — new button at every dungeon lobby. No revives. +25% enemy damage. **3× rewards.** Plus: exclusive **mythic relic** drops from bosses — 8 mythics across both dungeons. These are the best relics in the game and they only drop on hardcore.`,
      ``,
      `🎯 **DAILY + WEEKLY QUESTS** — \`/quests\` shows your 3 daily tasks + 2 weekly tasks. Auto-pays bucks + XP the moment you finish each one. Daily resets midnight EST. Weekly resets Monday.`,
      ``,
      `📈 **STOCK SPARKLINES** — every stock in \`#milkbot-stocks-info\` now shows its last 20 ticks as a block chart: \`▁▂▂▃▃▄▅▅▆▇▇█▇▇▆▅▄▃▂▁\`. Read the trend at a glance.`,
      ``,
      `🗣️ **BOT PERSONALITY** — cooldowns, broke checks, and "not worth it" messages now speak MilkBot's voice. Randomized variants so you don't see the same line twice. Expect more snark.`,
      ``,
      `🔧 **PORTFOLIO SELL FIX (v3)** — deepest portfolio normalization yet. Coerces string-numeric values, purges orphans, and comes with a \`/portdebug\` admin tool for surgical repairs. Your stuck stocks should unstick.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*— MilkBot Management. descend deeper. earn harder. the milk never settles. 🥛*`,
    ].join('\n'),
  },
  // v30-vault-hotfix removed — merged into v29 with blackjack 8s correction.
  {
    id: 'v26-public-patch-2',
    text: [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🥛 **MILKBOT PATCH — OPEN DOORS UPDATE** 🥛`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `⚡ **SLASH COMMANDS ONLY** — \`!\` commands are gone. Everything lives under \`/\` now. \`/g\` for games. \`/bal\`, \`/port\`, \`/b\`, \`/s\` for the rest. Type \`/\` and Discord shows you everything.`,
      ``,
      `📦 **CRATE CLAIMS** — \`!cc\` is gone. When a crate drops, open \`/g\` → Wallet → **Claim Crate**. Same reward, same window, cleaner channel.`,
      ``,
      `🐄 **RAID BOSS HP NOW SCALES WITH THE SERVER** — Boss HP adjusts based on how many active players are in the server. More recruits = bigger boss = bigger fight. The raid grows with you.`,
      ``,
      `⏱️ **8-SECOND COOLDOWN BETWEEN GAMES** — You can still play back to back, just not instantly. Finish one, wait 8 seconds, run it back.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*— MilkBot Management. the server is open. 🥛*`,
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

  // One-time cleanup: delete v30 post if present, edit v29 post with latest text.
  await cleanupV30AndSyncV29(channel).catch(e => console.warn('[updates] cleanup skipped:', e.message));

  // One-time retry of v32 — the initial post hit the 2000-char content limit
  // and was erroneously marked posted. Force a single retry now that
  // buildUpdatePayload auto-wraps long notes as embeds.
  await forceRetryV32Once();

  const posted = getPosted();
  const toPost = UPDATES.filter(u => !posted.includes(u.id));
  if (toPost.length === 0) return;

  for (const update of toPost) {
    // Only mark as posted when the send actually succeeds — prevents a
    // transient Discord error (like the 2000-char bug that ate v32) from
    // permanently blocking the patch note.
    const sent = await channel.send(buildUpdatePayload(update.text)).catch(e => {
      console.error('[updates] post failed:', e.message);
      return null;
    });
    if (sent) {
      posted.push(update.id);
      savePosted(posted);
    }
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`[updates] posted ${toPost.length} update(s)`);
}

// Strips v32 out of posted.json exactly once so the now-embed-wrapped post
// can actually land. Guarded by a flag file so it doesn't loop.
async function forceRetryV32Once() {
  const flagPath = path.join(__dirname, 'data/updates_v32_retry_done.json');
  if (fs.existsSync(flagPath)) return;
  try {
    const posted = getPosted();
    const next = posted.filter(id => id !== 'v32-creamspire-cosmos');
    if (next.length !== posted.length) {
      savePosted(next);
      console.log('[updates] v32 retry queued');
    }
    fs.writeFileSync(flagPath, JSON.stringify({ done: Date.now() }));
  } catch (e) {
    console.warn('[updates] v32 retry setup failed:', e.message);
  }
}

// In-memory guard so concurrent calls within the same process don't double-run the cleanup.
let _cleanupRunning = false;

async function cleanupV30AndSyncV29(channel) {
  const cleanupFlagPath = path.join(__dirname, 'data/updates_v30_cleanup_done.json');
  if (fs.existsSync(cleanupFlagPath)) return;
  if (_cleanupRunning) return;
  _cleanupRunning = true;

  try {
    const msgs = await channel.messages.fetch({ limit: 50 });
    let deleted = 0, edited = 0;

    const v29Entry = UPDATES.find(u => u.id === 'v29-spoiled-vault');
    const v29Text = v29Entry ? v29Entry.text : null;

    for (const msg of msgs.values()) {
      if (msg.author.id !== channel.client.user.id) continue;
      const content = msg.content || '';
      if (content.includes('MILKBOT HOTFIX — VAULT PATCHWORK')) {
        await msg.delete().catch(() => {});
        deleted++;
      } else if (v29Text && content.includes('MILKBOT PATCH — THE SPOILED VAULT') && content !== v29Text) {
        await msg.edit(v29Text).catch(() => {});
        edited++;
      }
    }

    fs.writeFileSync(cleanupFlagPath, JSON.stringify({ done: true, deleted, edited }));
    console.log(`[updates] v30 cleanup: deleted=${deleted}, v29 edited=${edited}`);
  } finally {
    _cleanupRunning = false;
  }
}

module.exports = { postUpdates };
