const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');

  function getBalances() {
    if (!fs.existsSync(balancesPath)) return {};
    return JSON.parse(fs.readFileSync(balancesPath, 'utf8'));
  }

  function getBalance(userId) {
    const balances = getBalances();
    return balances[userId] || 0;
  }

  module.exports = {
    name: 'bal',
    description: 'Check your milk bucks balance.',
    slashOptions: [],
    execute(message) {
      const balance = getBalance(message.author.id);
      message.reply(`Your balance is **${balance} milk bucks** 🥛`).then(reply => {
        setTimeout(() => { reply.delete().catch(() => {}); message.delete().catch(() => {}); }, 8000);
      });
    }
  };