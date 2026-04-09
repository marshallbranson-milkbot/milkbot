module.exports = {
    name: 'h',
    description: 'Shows all available commands.',
    execute(message) {
      const helpMessage = `
**MilkBot Commands** 🥛

**Leaderboard**
\`!mblb\` — Top 5 milk bucks leaderboard
\`!xplb\` — Top 5 XP leaderboard

**Currency**
\`!bal\` — Check your milk bucks balance
\`!xp\` — Check your XP, level, and rank
\`!da\` — Claim your daily milk bucks (streak bonuses up to 300)
\`!cc\` — Claim an active milk crate drop (500 milk bucks, first come first served)

**Games**
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

**Milk Stock Market** 📈
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
\`SPOIL\` Spoiled Rotten LLC — Chaotic (±5-30%)
      `;
      message.reply(helpMessage);
    }
  };