module.exports = {
    name: 'h',
    description: 'Shows all available commands.',
    execute(message) {
      const helpMessage = `
**MilkBot Commands** 🥛

**Leaderboard**
\`!lb\` — Top 5 milk bucks leaderboard

**Currency**
\`!bal\` — Check your milk bucks balance
\`!da\` — Claim your daily 100 milk bucks

**Games**
\`!cf @user amount\` — Challenge someone to a coinflip
\`!a\` / \`!d\` — Accept or decline a coinflip challenge
\`!fh amount\` — Flip against MilkBot directly
\`!g\` — Start a number guessing game (daily cooldown)
\`!sc\` — Unscramble a word to win milk bucks
\`!sl\` — Spin the slots for 10 milk bucks (30s cooldown)
\`!mt\` — Milk trivia (A/B/C, first correct wins 15 milk bucks)
      `;
      message.reply(helpMessage);
    }
  };