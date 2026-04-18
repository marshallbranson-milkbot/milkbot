 const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');
 const xpPath = path.join(__dirname, '../data/xp.json');
 const state = require('../state');
 const ws = require('../winstreak');
 const ach = require('../achievements');
 const jackpot = require('../jackpot');
 const prestige = require('../prestige');

  function getData(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (e) { console.error('[getData] corrupted:', filePath); return {}; }
  }

  function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  module.exports = {
    name: 'fh',
    description: 'Flip against MilkBot. Usage: !fh amount',
    execute(message, args) {
      const bet = parseInt(args[0], 10);
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
        const hotMul = newStreak >= 3 ? 1.5 : 1;
        const pm = prestige.getMultiplier(userId);
        const payout = Math.floor(bet * hotMul * pm);

        balances[userId] = Math.min(10_000_000, balance + payout);
        saveData(balancesPath, balances);

        const xp = getData(xpPath);
        xp[userId] = (xp[userId] || 0) + Math.floor(15 * (state.doubleXp ? 2 : 1) * hotMul * pm);
        saveData(xpPath, xp);

        const bonuses = [hotMul > 1 ? '🔥 1.5x streak' : '', pm > 1 ? `🌟 ${pm}x prestige` : ''].filter(Boolean).join(' · ');
        if (newStreak >= 3) ws.announceStreak(message.channel, message.author.username, newStreak);
        jackpot.tryJackpot(userId, message.author.username, message.channel);

        ach.check(userId, message.author.username, 'game_win', { balance: balances[userId], streak: newStreak, gameType: 'fh' }, message.channel);

        return message.channel.send(
          `🪙 **FLIP vs THE HOUSE** 🪙\n` +
          `${message.author.username} bet **${bet} milk bucks** against MilkBot.\n\n` +
          `**${message.author.username} wins!** The house takes the L. Enjoy it while it lasts. 🥛` +
          (bonuses ? ` *(${bonuses} — won ${payout})*` : '')
        );
      } else {
        const prevStreak = ws.resetStreak(userId);
        balances[userId] = balance - bet;
        saveData(balancesPath, balances);
        jackpot.addToJackpot(bet);

        if (prevStreak >= 3) message.channel.send(`❄️ **${message.author.username}'s hot streak is OVER** after ${prevStreak} wins. Back to normal. 🥛`);

        ach.check(userId, message.author.username, 'game_loss', { gameType: 'fh', balance: balances[userId] }, message.channel);

        return message.channel.send(
          `🪙 **FLIP vs THE HOUSE** 🪙\n` +
          `${message.author.username} bet **${bet} milk bucks** against MilkBot.\n\n` +
          `**MilkBot wins.** The house always wins. Better luck next time. 🥛`
        );
      }
    }
  };