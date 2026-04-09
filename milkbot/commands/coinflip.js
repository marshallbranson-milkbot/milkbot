  const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');

  function getData(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // Stores pending challenges in memory (clears on restart, that's fine)
  const pendingChallenges = {};

  module.exports = {
    name: 'cf',
    aliases: ['a', 'd'],
    description: 'Challenge someone to a coinflip. Usage: !cf @user amount',
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

        balances[winnerId] = (balances[winnerId] || 0) + bet;
        balances[loserId] = (balances[loserId] || 0) - bet;
        saveData(balancesPath, balances);

        const winnerName = challengerWins ? challenger?.username : message.author.username;
        const loserName = challengerWins ? message.author.username : challenger?.username;

        return message.channel.send(
          `🪙 **COINFLIP** 🪙\n` +
          `**${bet} milk bucks** on the line!\n\n` +
          `**${winnerName} wins!** 🎉 ${loserName} just got cleaned out. 🥛`
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
      const bet = parseInt(args[1]);

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