 const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');
 const xpPath = path.join(__dirname, '../data/xp.json');
 const state = require('../state');
 const ws = require('../winstreak');
 const ach = require('../achievements');

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
        const newStreak = ws.recordWin(userId);
        const multiplier = newStreak >= 3 ? 1.5 : 1;
        const payout = Math.floor(bet * multiplier);

        balances[userId] = balance + payout;
        saveData(balancesPath, balances);

        const xp = getData(xpPath);
        xp[userId] = (xp[userId] || 0) + Math.floor(15 * (state.doubleXp ? 2 : 1) * multiplier);
        saveData(xpPath, xp);

        if (newStreak === 3) message.channel.send(`🔥 **${message.author.username} is on a HOT STREAK!** 3 wins in a row — 1.5x on everything! 🥛`);

        ach.check(userId, message.author.username, 'game_win', { balance: balances[userId], streak: newStreak }, message.channel);

        return message.channel.send(
          `🪙 **FLIP vs THE HOUSE** 🪙\n` +
          `${message.author.username} bet **${bet} milk bucks** against MilkBot.\n\n` +
          `**${message.author.username} wins!** The house takes the L. Enjoy it while it lasts. 🥛` +
          (multiplier > 1 ? ` *(🔥 1.5x — won ${payout})*` : '')
        );
      } else {
        const prevStreak = ws.resetStreak(userId);
        balances[userId] = balance - bet;
        saveData(balancesPath, balances);

        if (prevStreak >= 3) message.channel.send(`❄️ **${message.author.username}'s hot streak is OVER** after ${prevStreak} wins. Back to normal. 🥛`);

        return message.channel.send(
          `🪙 **FLIP vs THE HOUSE** 🪙\n` +
          `${message.author.username} bet **${bet} milk bucks** against MilkBot.\n\n` +
          `**MilkBot wins.** The house always wins. Better luck next time. 🥛`
        );
      }
    }
  };