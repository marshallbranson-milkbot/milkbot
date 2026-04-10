const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');
const ws = require('../winstreak');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const REWARD = 5;
const GAME_TIME = 15000;
const SOLO_WITHIN = 10;

let activeGame = null;

function awardWinner(userId, username, channel) {
  const newStreak = ws.recordWin(userId);
  const multiplier = newStreak >= 3 ? 1.5 : 1;
  const reward = Math.floor(REWARD * multiplier);

  const balances = getData(balancesPath);
  balances[userId] = (balances[userId] || 0) + reward;
  saveData(balancesPath, balances);

  const xp = getData(xpPath);
  xp[userId] = (xp[userId] || 0) + Math.floor(20 * (state.doubleXp ? 2 : 1) * multiplier);
  saveData(xpPath, xp);

  if (newStreak === 3) channel.send(`🔥 **${username} is on a HOT STREAK!** 3 wins in a row — 1.5x on everything! 🥛`);

  return { reward, multiplier };
}

function resolveGame(channel) {
  if (!activeGame) return;
  const { number, guesses } = activeGame;
  activeGame = null;

  if (guesses.size === 0) {
    return channel.send(`⏰ Time's up! Nobody guessed. The number was **${number}**. 🥛`);
  }

  if (guesses.size === 1) {
    const [userId, { guess, username }] = [...guesses.entries()][0];
    const diff = Math.abs(guess - number);

    if (diff > SOLO_WITHIN) {
      ws.resetStreak(userId);
      return channel.send(
        `⏰ Time's up! **${username}** guessed **${guess}** but the number was **${number}** — ` +
        `too far off (must be within ${SOLO_WITHIN} to win solo). Nobody wins. 🥛`
      );
    }

    const { reward, multiplier } = awardWinner(userId, username, channel);
    channel.send(
      `🎯 The number was **${number}**! **${username}** guessed **${guess}** — close enough!\n` +
      `They win **${reward} milk bucks**!` + (multiplier > 1 ? ` *(🔥 1.5x hot streak)*` : '') + ` 🥛`
    );
    return;
  }

  // Multiple guessers — closest wins, first to guess wins ties
  let winnerId = null;
  let winnerEntry = null;
  let winnerDiff = Infinity;

  for (const [userId, data] of guesses.entries()) {
    const diff = Math.abs(data.guess - number);
    if (diff < winnerDiff) {
      winnerDiff = diff;
      winnerId = userId;
      winnerEntry = data;
    }
  }

  for (const [userId] of guesses.entries()) {
    if (userId !== winnerId) ws.resetStreak(userId);
  }

  const { reward, multiplier } = awardWinner(winnerId, winnerEntry.username, channel);
  channel.send(
    `🎯 The number was **${number}**!\n` +
    `**${winnerEntry.username}** was closest with **${winnerEntry.guess}** (off by ${winnerDiff}) — ` +
    `they win **${reward} milk bucks**!` + (multiplier > 1 ? ` *(🔥 1.5x hot streak)*` : '') + ` 🥛`
  );
}

function check(message) {
  if (!activeGame) return false;

  const guess = parseInt(message.content.trim());
  if (isNaN(guess) || guess < 1 || guess > 100) return false;

  if (activeGame.guesses.has(message.author.id)) {
    message.reply(`One guess per round. 🥛`);
    return true;
  }

  activeGame.guesses.set(message.author.id, { guess, username: message.author.username });
  message.reply(`Locked in. 🥛`);
  return true;
}

module.exports = {
  name: 'g',
  description: 'MilkBot picks a number 1-100. Closest guess in 15 seconds wins 150 milk bucks.',
  check,
  execute(message) {
    if (activeGame) {
      return message.reply(`A game is already running! Type a number between **1 and 100**. ⏳`);
    }

    const number = Math.floor(Math.random() * 100) + 1;
    const guesses = new Map();

    const timeout = setTimeout(() => resolveGame(message.channel), GAME_TIME);
    activeGame = { number, guesses, timeout };

    message.channel.send(
      `🎯 **GUESS THE NUMBER** 🎯\n` +
      `I'm thinking of a number between **1 and 100**.\n` +
      `Everyone gets **one guess**. Closest after **15 seconds** wins **${REWARD} milk bucks**!\n` +
      `*(Playing solo? You must be within ${SOLO_WITHIN})*\n` +
      `Start guessing! ⏳`
    );
  }
};
