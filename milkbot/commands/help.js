module.exports = {
    name: 'h',
    description: 'Shows all available commands.',
    execute(message) {
      const helpMessage = `
**MilkBot Commands** 🥛

**Currency**
\`!bal\` — Check your milk bucks balance
\`!d\` — Claim your daily 100 milk bucks

**Games**
\`!cf @user amount\` — Challenge someone to a coinflip
\`!accept\` / \`!decline\` — Respond to a coinflip challenge
\`!fh amount\` — Flip against MilkBot directly
\`!g\` — Start a number guessing game (daily cooldown)
\`!sc\` — Unscramble a word to win milk bucks
\`!sl\` — Spin the slots for 10 milk bucks (30s cooldown)
      `;
      message.reply(helpMessage);
    }
  };