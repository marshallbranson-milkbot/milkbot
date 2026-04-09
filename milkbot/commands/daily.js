const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');
  const cooldownsPath = path.join(__dirname, '../data/cooldowns.json');

  function getData(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  const DAILY_AMOUNT = 100;
  const COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  module.exports = {
    name: 'd',
    description: 'Claim your daily 100 milk bucks.',
    execute(message) {
      const userId = message.author.id;
      const now = Date.now();

      const cooldowns = getData(cooldownsPath);
      const lastClaim = cooldowns[userId] || 0;
      const timeLeft = COOLDOWN - (now - lastClaim);

      if (timeLeft > 0) {
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        return message.reply(`Slow down. You already got your milk today. Come back in **${hours}h ${minutes}m**. 🥛`);
      }

      const balances = getData(balancesPath);
      balances[userId] = (balances[userId] || 0) + DAILY_AMOUNT;
      cooldowns[userId] = now;

      saveData(balancesPath, balances);
      saveData(cooldownsPath, cooldowns);

      message.reply(`Here's your daily **${DAILY_AMOUNT} milk bucks**. Don't spend it all in one place. 🥛`);
    }
  };