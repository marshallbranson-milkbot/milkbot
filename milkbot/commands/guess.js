 const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');
  const cooldownsPath = path.join(__dirname, '../data/cooldowns.json');
  const xpPath = path.join(__dirname, '../data/xp.json');
  const state = require('../state');

  function getData(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  const GUESS_COOLDOWN = 24 * 60 * 60 * 1000;
  const REWARD = 150;
  const GUESS_TIME = 30000;

  let activeGame = null;

  function check(message) {
    if (!activeGame) return false;

    const guess = parseInt(message.content.trim());
    if (isNaN(guess) || guess < 1 || guess > 100) return false;

    if (activeGame.guessed.has(message.author.id)) {
      message.reply("You already guessed this round. One shot per person. 🥛");
      return true;
    }

    activeGame.guessed.add(message.author.id);

    if (guess === activeGame.number) {
      const balances = getData(balancesPath);
      balances[message.author.id] = (balances[message.author.id] || 0) + REWARD;
      saveData(balancesPath, balances);

      const xp = getData(xpPath);
      xp[message.author.id] = (xp[message.author.id] || 0) + (20 * (state.doubleXp ? 2 : 1));
      saveData(xpPath, xp);

      clearTimeout(activeGame.timeout);
      activeGame = null;

      message.channel.send(
        `🎯 **${message.author.username} got it!** The number was **${guess}**.\n` +
        `They just earned **${REWARD} milk bucks**. 🥛`
      );
      return true;
    } else {
      const direction = guess < activeGame.number ? 'Too low.' : 'Too high.';
      message.reply(`${direction} Keep guessing!`);
      return true;
    }
  }

  module.exports = {
    name: 'g',
    description: 'MilkBot picks a number 1-100. First to guess it wins 150 milk bucks.',
    check,
    execute(message) {
      const userId = message.author.id;
      const now = Date.now();

      if (activeGame) {
        return message.reply(`A game is already running! Just type a number between 1 and 100.`);
      }

      const cooldowns = getData(cooldownsPath);
      const lastGuess = cooldowns[`guess_${userId}`] || 0;
      const timeLeft = GUESS_COOLDOWN - (now - lastGuess);

      if (timeLeft > 0) {
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        return message.reply(`You already started a guess game today. Come back in **${hours}h ${minutes}m**. 🥛`);
      }

      cooldowns[`guess_${userId}`] = now;
      saveData(cooldownsPath, cooldowns);

      const number = Math.floor(Math.random() * 100) + 1;
      const guessed = new Set();

      const timeout = setTimeout(() => {
        if (activeGame) {
          message.channel.send(`⏰ Time's up! Nobody guessed it. The number was **${activeGame.number}**. 🥛`);
          activeGame = null;
        }
      }, GUESS_TIME);

      activeGame = { number, guessed, timeout };

      message.channel.send(
        `🎯 **GUESS THE NUMBER** 🎯\n` +
        `I'm thinking of a number between **1 and 100**.\n` +
        `Just type your number in chat. First correct answer wins **${REWARD} milk bucks**!\n` +
        `You have **30 seconds**. ⏳`
      );
    }
  };