 const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');
 const xpPath = path.join(__dirname, '../data/xp.json');
 const state = require('../state');

  function getData(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  module.exports = {
    name: 'fh',
    description: 'Flip against MilkBot. Usage: !fh amount',
    execute(message, args) {
      const bet = parseInt(args[0]);
      const userId = message.author.id;

      if (!bet || isNaN(bet) || bet <= 0) {
        return message.reply('Enter a valid amount. `!fh amount`');
      }

      const balances = getData(balancesPath);
      const balance = balances[userId] || 0;

      if (balance < bet) {
        return message.reply(`You don't have enough milk bucks. Your balance is **${balance}** 🥛`);
      }

      const playerWins = Math.random() < 0.5;

      if (playerWins) {
        balances[userId] = balance + bet;
        saveData(balancesPath, balances);

        const xp = getData(xpPath);
        xp[userId] = (xp[userId] || 0) + (15 * (state.doubleXp ? 2 : 1));
        saveData(xpPath, xp);
        return message.channel.send(
          `🪙 **FLIP vs THE HOUSE** 🪙\n` +
          `${message.author.username} bet **${bet} milk bucks** against MilkBot.\n\n` +
          `**${message.author.username} wins!** The house takes the L. Enjoy it while it lasts. 🥛`
        );
      } else {
        balances[userId] = balance - bet;
        saveData(balancesPath, balances);
        return message.channel.send(
          `🪙 **FLIP vs THE HOUSE** 🪙\n` +
          `${message.author.username} bet **${bet} milk bucks** against MilkBot.\n\n` +
          `**MilkBot wins.** The house always wins. Better luck next time. 🥛`
        );
      }
    }
  };