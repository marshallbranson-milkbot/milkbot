module.exports = {
    name: 'help',
    description: 'Shows all available commands.',
    execute(message) {
      const helpMessage = `
  **MilkBot Commands** 🥛

  **Currency**
  \`!balance\` / \`!wallet\` — Check your milk bucks balance
  \`!daily\` — Claim your daily 100 milk bucks

  **Games**
  \`!coinflip @user amount\` — Challenge someone to a coinflip
  \`!accept\` / \`!decline\` — Respond to a coinflip challenge
  \`!fliphouse amount\` — Flip against MilkBot directly
  \`!guess\` — Start a number guessing game (daily cooldown)
  \`!scramble\` — Unscramble a word to win milk bucks
      `;
      message.reply(helpMessage);
    }
  };