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

const REWARD = 25;
const XP_REWARD = 35;
const GAME_TIME = 15000;

const countries = [
  { name: 'Afghanistan', flag: '🇦🇫', aliases: [] },
  { name: 'Argentina', flag: '🇦🇷', aliases: [] },
  { name: 'Australia', flag: '🇦🇺', aliases: [] },
  { name: 'Austria', flag: '🇦🇹', aliases: [] },
  { name: 'Belgium', flag: '🇧🇪', aliases: [] },
  { name: 'Brazil', flag: '🇧🇷', aliases: ['brasil'] },
  { name: 'Canada', flag: '🇨🇦', aliases: [] },
  { name: 'Chile', flag: '🇨🇱', aliases: [] },
  { name: 'China', flag: '🇨🇳', aliases: [] },
  { name: 'Colombia', flag: '🇨🇴', aliases: [] },
  { name: 'Croatia', flag: '🇭🇷', aliases: [] },
  { name: 'Cuba', flag: '🇨🇺', aliases: [] },
  { name: 'Czech Republic', flag: '🇨🇿', aliases: ['czechia'] },
  { name: 'Denmark', flag: '🇩🇰', aliases: [] },
  { name: 'Egypt', flag: '🇪🇬', aliases: [] },
  { name: 'Ethiopia', flag: '🇪🇹', aliases: [] },
  { name: 'Finland', flag: '🇫🇮', aliases: [] },
  { name: 'France', flag: '🇫🇷', aliases: [] },
  { name: 'Germany', flag: '🇩🇪', aliases: [] },
  { name: 'Ghana', flag: '🇬🇭', aliases: [] },
  { name: 'Greece', flag: '🇬🇷', aliases: [] },
  { name: 'Hungary', flag: '🇭🇺', aliases: [] },
  { name: 'India', flag: '🇮🇳', aliases: [] },
  { name: 'Indonesia', flag: '🇮🇩', aliases: [] },
  { name: 'Iran', flag: '🇮🇷', aliases: [] },
  { name: 'Iraq', flag: '🇮🇶', aliases: [] },
  { name: 'Ireland', flag: '🇮🇪', aliases: [] },
  { name: 'Israel', flag: '🇮🇱', aliases: [] },
  { name: 'Italy', flag: '🇮🇹', aliases: [] },
  { name: 'Japan', flag: '🇯🇵', aliases: [] },
  { name: 'Jordan', flag: '🇯🇴', aliases: [] },
  { name: 'Kenya', flag: '🇰🇪', aliases: [] },
  { name: 'Malaysia', flag: '🇲🇾', aliases: [] },
  { name: 'Mexico', flag: '🇲🇽', aliases: [] },
  { name: 'Morocco', flag: '🇲🇦', aliases: [] },
  { name: 'Netherlands', flag: '🇳🇱', aliases: ['holland'] },
  { name: 'New Zealand', flag: '🇳🇿', aliases: [] },
  { name: 'Nigeria', flag: '🇳🇬', aliases: [] },
  { name: 'North Korea', flag: '🇰🇵', aliases: [] },
  { name: 'Norway', flag: '🇳🇴', aliases: [] },
  { name: 'Pakistan', flag: '🇵🇰', aliases: [] },
  { name: 'Peru', flag: '🇵🇪', aliases: [] },
  { name: 'Philippines', flag: '🇵🇭', aliases: [] },
  { name: 'Poland', flag: '🇵🇱', aliases: [] },
  { name: 'Portugal', flag: '🇵🇹', aliases: [] },
  { name: 'Romania', flag: '🇷🇴', aliases: [] },
  { name: 'Russia', flag: '🇷🇺', aliases: ['russian federation'] },
  { name: 'Saudi Arabia', flag: '🇸🇦', aliases: [] },
  { name: 'South Africa', flag: '🇿🇦', aliases: [] },
  { name: 'South Korea', flag: '🇰🇷', aliases: ['korea'] },
  { name: 'Spain', flag: '🇪🇸', aliases: [] },
  { name: 'Sudan', flag: '🇸🇩', aliases: [] },
  { name: 'Sweden', flag: '🇸🇪', aliases: [] },
  { name: 'Switzerland', flag: '🇨🇭', aliases: [] },
  { name: 'Tanzania', flag: '🇹🇿', aliases: [] },
  { name: 'Thailand', flag: '🇹🇭', aliases: [] },
  { name: 'Turkey', flag: '🇹🇷', aliases: [] },
  { name: 'Ukraine', flag: '🇺🇦', aliases: [] },
  { name: 'United Kingdom', flag: '🇬🇧', aliases: ['uk', 'britain', 'england'] },
  { name: 'United States', flag: '🇺🇸', aliases: ['usa', 'us', 'america'] },
  { name: 'Venezuela', flag: '🇻🇪', aliases: [] },
  { name: 'Vietnam', flag: '🇻🇳', aliases: [] },
  { name: 'Zimbabwe', flag: '🇿🇼', aliases: [] },
];

let activeGeo = null;

function isCorrect(guess, country) {
  const g = guess.toLowerCase().trim();
  return g === country.name.toLowerCase() || country.aliases.includes(g);
}

function check(message) {
  if (!activeGeo) return false;
  if (message.content.startsWith('!')) return false;

  const guess = message.content.trim();
  if (!guess || guess.length > 60) return false;

  if (isCorrect(guess, activeGeo.country)) {
    const userId = message.author.id;
    const newStreak = ws.recordWin(userId);
    const multiplier = newStreak >= 3 ? 1.5 : 1;
    const reward = Math.floor(REWARD * multiplier);
    const xpGain = Math.floor(XP_REWARD * (state.doubleXp ? 2 : 1) * multiplier);

    const balances = getData(balancesPath);
    balances[userId] = (balances[userId] || 0) + reward;
    saveData(balancesPath, balances);

    const xp = getData(xpPath);
    xp[userId] = (xp[userId] || 0) + xpGain;
    saveData(xpPath, xp);

    clearTimeout(activeGeo.timeout);
    const countryName = activeGeo.country.name;
    activeGeo = null;

    if (newStreak === 3) message.channel.send(`🔥 **${message.author.username} is on a HOT STREAK!** 3 wins in a row — 1.5x on everything! 🥛`);

    ach.check(userId, message.author.username, 'game_win', { balance: balances[userId], xp: xp[userId], streak: newStreak, gameType: 'geo' }, message.channel);

    message.channel.send(
      `✅ **${message.author.username} got it!** The country was **${countryName}**.\n` +
      `+**${reward} milk bucks**!` + (multiplier > 1 ? ` *(🔥 1.5x hot streak)*` : '') + ` 🥛`
    );
    return true;
  }

  ach.check(message.author.id, message.author.username, 'game_loss', { gameType: 'geo' }, message.channel);
  return true;
}

module.exports = {
  name: 'geo',
  description: 'Guess the country from the flag. First correct answer wins 25 milk bucks.',
  check,
  execute(message) {
    if (activeGeo) {
      return message.reply(`A game is already active! Guess the flag. ⏳`);
    }

    const country = countries[Math.floor(Math.random() * countries.length)];

    const timeout = setTimeout(() => {
      if (activeGeo) {
        const name = activeGeo.country.name;
        activeGeo = null;
        message.channel.send(`⏰ Time's up! Nobody got it. The country was **${name}**. 🥛`);
      }
    }, GAME_TIME);

    activeGeo = { country, timeout };

    message.channel.send(
      `🚩 **WHAT COUNTRY IS THIS FLAG?** 🚩\n\n` +
      `${country.flag}\n\n` +
      `Type the country name in chat. First correct answer wins **${REWARD} milk bucks**!\n` +
      `You have **15 seconds**. ⏳`
    );
  }
};
