const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');

  function getBalances() {
    return JSON.parse(fs.readFileSync(balancesPath, 'utf8'));
  }

  function getBalance(userId) {
    const balances = getBalances();
    return balances[userId] || 0;
  }

  module.exports = {
    name: 'balance',
    aliases: ['wallet'],
    description: 'Check your milk bucks balance.',
    execute(message) {
      const balance = getBalance(message.author.id);
      message.reply(`Your balance is **${balance} milk bucks** 🥛`);
    }
  };