const { EmbedBuilder } = require('discord.js');
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

const REWARD = 50;
const XP_REWARD = 35;
const GAME_TIME = 30000;

const countries = [
  { name: 'Afghanistan', lat: 33.93, lon: 67.71, aliases: [] },
  { name: 'Argentina', lat: -38.42, lon: -63.62, aliases: [] },
  { name: 'Australia', lat: -25.27, lon: 133.78, aliases: [] },
  { name: 'Brazil', lat: -14.24, lon: -51.93, aliases: [] },
  { name: 'Canada', lat: 56.13, lon: -106.35, aliases: [] },
  { name: 'Chile', lat: -35.68, lon: -71.54, aliases: [] },
  { name: 'China', lat: 35.86, lon: 104.20, aliases: [] },
  { name: 'Colombia', lat: 4.57, lon: -74.30, aliases: [] },
  { name: 'Egypt', lat: 26.82, lon: 30.80, aliases: [] },
  { name: 'Ethiopia', lat: 9.15, lon: 40.49, aliases: [] },
  { name: 'France', lat: 46.23, lon: 2.21, aliases: [] },
  { name: 'Germany', lat: 51.17, lon: 10.45, aliases: [] },
  { name: 'Ghana', lat: 7.95, lon: -1.02, aliases: [] },
  { name: 'Greece', lat: 39.07, lon: 21.82, aliases: [] },
  { name: 'Hungary', lat: 47.16, lon: 19.50, aliases: [] },
  { name: 'India', lat: 20.59, lon: 78.96, aliases: [] },
  { name: 'Indonesia', lat: -0.79, lon: 113.92, aliases: [] },
  { name: 'Iran', lat: 32.43, lon: 53.69, aliases: [] },
  { name: 'Iraq', lat: 33.22, lon: 43.68, aliases: [] },
  { name: 'Italy', lat: 41.87, lon: 12.57, aliases: [] },
  { name: 'Japan', lat: 36.20, lon: 138.25, aliases: [] },
  { name: 'Kenya', lat: -0.02, lon: 37.91, aliases: [] },
  { name: 'Malaysia', lat: 4.21, lon: 101.98, aliases: [] },
  { name: 'Mexico', lat: 23.63, lon: -102.55, aliases: [] },
  { name: 'Morocco', lat: 31.79, lon: -7.09, aliases: [] },
  { name: 'New Zealand', lat: -40.90, lon: 174.89, aliases: [] },
  { name: 'Nigeria', lat: 9.08, lon: 8.68, aliases: [] },
  { name: 'Norway', lat: 60.47, lon: 8.47, aliases: [] },
  { name: 'Pakistan', lat: 30.38, lon: 69.35, aliases: [] },
  { name: 'Peru', lat: -9.19, lon: -75.02, aliases: [] },
  { name: 'Philippines', lat: 12.88, lon: 121.77, aliases: [] },
  { name: 'Poland', lat: 51.92, lon: 19.15, aliases: [] },
  { name: 'Portugal', lat: 39.40, lon: -8.22, aliases: [] },
  { name: 'Romania', lat: 45.94, lon: 24.97, aliases: [] },
  { name: 'Russia', lat: 61.52, lon: 105.32, aliases: [] },
  { name: 'Saudi Arabia', lat: 23.89, lon: 45.08, aliases: [] },
  { name: 'South Africa', lat: -30.56, lon: 22.94, aliases: [] },
  { name: 'South Korea', lat: 35.91, lon: 127.77, aliases: ['korea'] },
  { name: 'Spain', lat: 40.46, lon: -3.75, aliases: [] },
  { name: 'Sudan', lat: 12.86, lon: 30.22, aliases: [] },
  { name: 'Sweden', lat: 60.13, lon: 18.64, aliases: [] },
  { name: 'Tanzania', lat: -6.37, lon: 34.89, aliases: [] },
  { name: 'Thailand', lat: 15.87, lon: 100.99, aliases: [] },
  { name: 'Turkey', lat: 38.96, lon: 35.24, aliases: [] },
  { name: 'Ukraine', lat: 48.38, lon: 31.17, aliases: [] },
  { name: 'United Kingdom', lat: 55.38, lon: -3.44, aliases: ['uk', 'britain', 'england'] },
  { name: 'United States', lat: 37.09, lon: -95.71, aliases: ['usa', 'us', 'america'] },
  { name: 'Venezuela', lat: 6.42, lon: -66.59, aliases: [] },
  { name: 'Vietnam', lat: 14.06, lon: 108.28, aliases: [] },
  { name: 'Zimbabwe', lat: -19.02, lon: 29.15, aliases: [] },
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

    message.channel.send(
      `✅ **${message.author.username} got it!** The country was **${countryName}**.\n` +
      `+**${reward} milk bucks**!` + (multiplier > 1 ? ` *(🔥 1.5x hot streak)*` : '') + ` 🥛`
    );
    return true;
  }

  // Consume wrong guesses silently to avoid spam
  return true;
}

module.exports = {
  name: 'geo',
  description: 'Guess the country from a map. First correct answer wins 50 milk bucks.',
  check,
  execute(message) {
    if (activeGeo) {
      return message.reply(`A game is already active! Guess the country on the map. ⏳`);
    }

    const country = countries[Math.floor(Math.random() * countries.length)];
    const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${country.lat},${country.lon}&zoom=4&size=600x400&markers=${country.lat},${country.lon},red-pushpin&maptype=mapnik`;

    const timeout = setTimeout(() => {
      if (activeGeo) {
        const name = activeGeo.country.name;
        activeGeo = null;
        message.channel.send(`⏰ Time's up! Nobody got it. The country was **${name}**. 🥛`);
      }
    }, GAME_TIME);

    activeGeo = { country, timeout };

    const embed = new EmbedBuilder()
      .setTitle('🌍 GEOGUESSER')
      .setDescription(
        `Where is the pin? Type the country name in chat!\n` +
        `First correct answer wins **${REWARD} milk bucks**. You have **30 seconds**. ⏳`
      )
      .setImage(mapUrl)
      .setColor(0x2ecc71);

    message.channel.send({ embeds: [embed] });
  }
};
