  const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');
  const xpPath = path.join(__dirname, '../data/xp.json');
  const state = require('../state');
  const ws = require('../winstreak');
  const ach = require('../achievements');
  const jackpot = require('../jackpot');
  const prestige = require('../prestige');
  const { milkLordTag } = require('./milklord');

  function getData(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (e) { console.error('[getData] corrupted:', filePath); return {}; }
  }

  function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // Stores pending challenges in memory (clears on restart, that's fine)
  const pendingChallenges = {};

  module.exports = {
    name: 'cf',
    aliases: ['a', 'd'],
    description: 'Challenge someone to a coinflip.',
    slashOptions: [],         // /a and /d — no args needed (accept/decline pending challenge)
    slashAliases: ['a', 'd'], // registered as separate slash commands routing to this execute
    execute(message, args) {
      const balances = getData(balancesPath);

      // --- ACCEPT ---
      if (message.content.startsWith('!a')) {
        const challenge = pendingChallenges[message.author.id];
        if (!challenge) {
          return message.reply("You don't have any pending challenges.");
        }

        clearTimeout(challenge.timeout);
        delete pendingChallenges[message.author.id];

        const { challengerId, bet } = challenge;
        const challenger = message.guild.members.cache.get(challengerId)?.user;

        const challengerBalance = balances[challengerId] || 0;
        const opponentBalance = balances[message.author.id] || 0;

        if (challengerBalance < bet) {
          return message.channel.send(`<@${challengerId}> ran out of milk bucks and can't cover the bet anymore.
  Embarrassing. 🥛`);
        }

        if (opponentBalance < bet) {
          return message.reply(`You don't have enough milk bucks to cover this bet. Your balance is
  **${opponentBalance}** 🥛`);
        }

        const challengerWins = Math.random() < 0.5;
        const winnerId = challengerWins ? challengerId : message.author.id;
        const loserId = challengerWins ? message.author.id : challengerId;

        const newStreak = ws.recordWin(winnerId);
        const hotMul = newStreak >= 3 ? 1.5 : 1;
        const pm = prestige.getMultiplier(winnerId);
        const shopMod = require('../shop');
        const shopMul = shopMod.getEarningsMul(winnerId);
        const nextMul = shopMod.getAndConsumeNextWinMul(winnerId);
        const bonus = Math.floor(bet * (hotMul * pm * shopMul * nextMul - 1));

        balances[winnerId] = Math.min(1_000_000_000, (balances[winnerId] || 0) + bet + bonus);
        balances[loserId] = Math.max(0, (balances[loserId] || 0) - bet);
        saveData(balancesPath, balances);

        const prevLoserStreak = ws.resetStreak(loserId);

        const xp = getData(xpPath);
        const shopXpMul = shopMod.getXpMul(winnerId);
        xp[winnerId] = Math.min(require('../prestige').getXpCap(winnerId), (xp[winnerId] || 0) + Math.floor(15 * (state.doubleXp ? 2 : 1) * hotMul * pm * shopXpMul));
        saveData(xpPath, xp);

        const winnerName = challengerWins ? challenger?.username : message.author.username;
        const loserName = challengerWins ? message.author.username : challenger?.username;

        const bonuses = [hotMul > 1 ? '🔥 1.5x streak' : '', pm > 1 ? `🌟 ${pm}x prestige` : ''].filter(Boolean).join(' · ');
        jackpot.addToJackpot(bet);
        if (newStreak >= 3) ws.announceStreak(message.channel, winnerName, newStreak);
        if (prevLoserStreak >= 3) message.channel.send(`❄️ **${loserName}'s hot streak is OVER** after ${prevLoserStreak} wins. Back to normal. 🥛`);
        jackpot.tryJackpot(winnerId, winnerName, message.channel);

        ach.check(winnerId, winnerName, 'coinflip_win', { balance: balances[winnerId], streak: newStreak, gameType: 'coinflip' }, message.channel);
        ach.check(loserId, loserName, 'coinflip_loss', { balance: balances[loserId] }, message.channel);

        return message.channel.send(
          `🪙 **COINFLIP** 🪙\n` +
          `**${bet} milk bucks** on the line!\n\n` +
          `**${winnerName}**${milkLordTag(winnerId, message.guild)} **wins!** 🎉 ${loserName} just got cleaned out. 🥛` +
          (bonuses ? ` *(${bonuses} — won ${bet + bonus})*` : '')
        );
      }

      // --- DECLINE ---
      if (message.content.startsWith('!d')) {
        const challenge = pendingChallenges[message.author.id];
        if (!challenge) {
          return message.reply("You don't have any pending challenges.");
        }

        clearTimeout(challenge.timeout);
        delete pendingChallenges[message.author.id];
        return message.reply(`Challenge declined. Probably smart. 🥛`);
      }

      // --- CHALLENGE ---
      const challenger = message.author;
      const opponent = message.mentions.users.first();
      const bet = parseInt(args[1], 10);

      if (!opponent) {
        return message.reply('You need to tag someone. `!cf @user amount`');
      }

      if (opponent.bot) {
        return message.reply("Can't challenge a bot. Try `!fh` if you want to go against the house. 🥛");
      }

      if (opponent.id === challenger.id) {
        return message.reply("You can't flip against yourself. That's just sad.");
      }

      if (!bet || isNaN(bet) || bet <= 0) {
        return message.reply('Enter a valid amount. `!cf @user amount`');
      }

      const challengerBalance = balances[challenger.id] || 0;
      if (challengerBalance < bet) {
        return message.reply(`You don't have enough milk bucks. Your balance is **${challengerBalance}** 🥛`);
      }

      if (pendingChallenges[opponent.id]) {
        return message.reply(`${opponent.username} already has a pending challenge. Let that resolve first.`);
      }

      // Set challenge to expire after 60 seconds
      const timeout = setTimeout(() => {
        delete pendingChallenges[opponent.id];
        message.channel.send(`⏰ ${opponent.username} took too long to respond. Challenge expired. 🥛`);
      }, 60000);

      pendingChallenges[opponent.id] = {
        challengerId: challenger.id,
        bet,
        timeout
      };

      message.channel.send(
        `🪙 **COINFLIP CHALLENGE** 🪙\n` +
        `${challenger.username} is challenging ${opponent.username} to a flip for **${bet} milk bucks**!\n\n` +
        `${opponent.username}, type \`!a\` to accept or \`!d\` to decline. You have 60 seconds. ⏳`
      );
    }
  };