const fs = require('fs');
const path = require('path');
const https = require('https');
const { EmbedBuilder } = require('discord.js');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');
const ws = require('../winstreak');
const ach = require('../achievements');
const jackpot = require('../jackpot');
const prestige = require('../prestige');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const REWARD    = 50;
const XP_REWARD = 40;
const GAME_TIME = 30000;
const HINT_TIME = 15000;

// ─── LOCATIONS ──────────────────────────────────────────────────────────────
// `article` = Wikipedia article title. Image is fetched from the Wikipedia
// REST API at game time, so URLs are always valid and up to date.

const LOCATIONS = [
  // ── EUROPE ──────────────────────────────────────────────────────────────────
  { country: 'Norway',         continent: 'Europe',   aliases: [],                                    article: 'Geirangerfjord' },
  { country: 'Norway',         continent: 'Europe',   aliases: [],                                    article: 'Trolltunga' },
  { country: 'Iceland',        continent: 'Europe',   aliases: [],                                    article: 'Jökulsárlón' },
  { country: 'Iceland',        continent: 'Europe',   aliases: [],                                    article: 'Skógafoss' },
  { country: 'Switzerland',    continent: 'Europe',   aliases: [],                                    article: 'Matterhorn' },
  { country: 'Switzerland',    continent: 'Europe',   aliases: [],                                    article: 'Grindelwald' },
  { country: 'Italy',          continent: 'Europe',   aliases: [],                                    article: 'Amalfi Coast' },
  { country: 'Italy',          continent: 'Europe',   aliases: [],                                    article: 'Dolomites' },
  { country: 'Greece',         continent: 'Europe',   aliases: [],                                    article: 'Santorini' },
  { country: 'Greece',         continent: 'Europe',   aliases: [],                                    article: 'Meteora' },
  { country: 'France',         continent: 'Europe',   aliases: [],                                    article: 'Mont Saint-Michel' },
  { country: 'France',         continent: 'Europe',   aliases: [],                                    article: 'Gorges du Verdon' },
  { country: 'Netherlands',    continent: 'Europe',   aliases: ['holland'],                           article: 'Kinderdijk' },
  { country: 'Germany',        continent: 'Europe',   aliases: [],                                    article: 'Neuschwanstein Castle' },
  { country: 'Germany',        continent: 'Europe',   aliases: [],                                    article: 'Rhine Gorge' },
  { country: 'Spain',          continent: 'Europe',   aliases: [],                                    article: 'Sagrada Família' },
  { country: 'Spain',          continent: 'Europe',   aliases: [],                                    article: 'Alhambra' },
  { country: 'Portugal',       continent: 'Europe',   aliases: [],                                    article: 'Sintra' },
  { country: 'United Kingdom', continent: 'Europe',   aliases: ['uk','britain','england','scotland'],  article: 'Stonehenge' },
  { country: 'United Kingdom', continent: 'Europe',   aliases: ['uk','britain','scotland'],            article: 'Scottish Highlands' },
  { country: 'Ireland',        continent: 'Europe',   aliases: [],                                    article: 'Cliffs of Moher' },
  { country: 'Czech Republic', continent: 'Europe',   aliases: ['czechia'],                           article: 'Prague' },
  { country: 'Austria',        continent: 'Europe',   aliases: [],                                    article: 'Hallstatt' },
  { country: 'Hungary',        continent: 'Europe',   aliases: [],                                    article: 'Hungarian Parliament Building' },
  { country: 'Poland',         continent: 'Europe',   aliases: [],                                    article: 'Kraków' },
  { country: 'Croatia',        continent: 'Europe',   aliases: [],                                    article: 'Dubrovnik' },
  { country: 'Croatia',        continent: 'Europe',   aliases: [],                                    article: 'Plitvice Lakes National Park' },
  { country: 'Sweden',         continent: 'Europe',   aliases: [],                                    article: 'Stockholm' },
  { country: 'Finland',        continent: 'Europe',   aliases: [],                                    article: 'Finnish Lakeland' },
  { country: 'Romania',        continent: 'Europe',   aliases: [],                                    article: 'Bran Castle' },
  { country: 'Russia',         continent: 'Europe',   aliases: ['russian federation'],                article: "Saint Basil's Cathedral" },
  { country: 'Ukraine',        continent: 'Europe',   aliases: [],                                    article: 'Kyiv Pechersk Lavra' },
  { country: 'Turkey',         continent: 'Europe',   aliases: ['türkiye'],                           article: 'Cappadocia' },
  { country: 'Turkey',         continent: 'Europe',   aliases: ['türkiye'],                           article: 'Hagia Sophia' },
  { country: 'Belgium',        continent: 'Europe',   aliases: [],                                    article: 'Bruges' },
  { country: 'Denmark',        continent: 'Europe',   aliases: [],                                    article: 'Nyhavn' },

  // ── ASIA ────────────────────────────────────────────────────────────────────
  { country: 'Japan',                  continent: 'Asia', aliases: [],                                article: 'Mount Fuji' },
  { country: 'Japan',                  continent: 'Asia', aliases: [],                                article: 'Arashiyama' },
  { country: 'Japan',                  continent: 'Asia', aliases: [],                                article: 'Fushimi Inari-taisha' },
  { country: 'China',                  continent: 'Asia', aliases: [],                                article: 'Great Wall of China' },
  { country: 'China',                  continent: 'Asia', aliases: [],                                article: 'Zhangjiajie National Forest Park' },
  { country: 'South Korea',            continent: 'Asia', aliases: ['korea'],                         article: 'Gyeongbokgung' },
  { country: 'India',                  continent: 'Asia', aliases: [],                                article: 'Taj Mahal' },
  { country: 'India',                  continent: 'Asia', aliases: [],                                article: 'Hawa Mahal' },
  { country: 'India',                  continent: 'Asia', aliases: [],                                article: 'Hampi' },
  { country: 'Vietnam',                continent: 'Asia', aliases: [],                                article: 'Hạ Long Bay' },
  { country: 'Vietnam',                continent: 'Asia', aliases: [],                                article: 'Mù Cang Chải' },
  { country: 'Thailand',               continent: 'Asia', aliases: [],                                article: 'Wat Phra Kaew' },
  { country: 'Indonesia',              continent: 'Asia', aliases: [],                                article: 'Pura Ulun Danu Bratan' },
  { country: 'Indonesia',              continent: 'Asia', aliases: [],                                article: 'Borobudur' },
  { country: 'Nepal',                  continent: 'Asia', aliases: [],                                article: 'Annapurna Conservation Area' },
  { country: 'Philippines',            continent: 'Asia', aliases: [],                                article: 'Chocolate Hills' },
  { country: 'Philippines',            continent: 'Asia', aliases: [],                                article: 'Banaue Rice Terraces' },
  { country: 'Malaysia',               continent: 'Asia', aliases: [],                                article: 'Petronas Towers' },
  { country: 'Cambodia',               continent: 'Asia', aliases: [],                                article: 'Angkor Wat' },
  { country: 'Mongolia',               continent: 'Asia', aliases: [],                                article: 'Mongolian steppe' },
  { country: 'Jordan',                 continent: 'Asia', aliases: [],                                article: 'Petra' },
  { country: 'Jordan',                 continent: 'Asia', aliases: [],                                article: 'Wadi Rum' },
  { country: 'Israel',                 continent: 'Asia', aliases: [],                                article: 'Dome of the Rock' },
  { country: 'United Arab Emirates',   continent: 'Asia', aliases: ['uae','emirates','dubai'],        article: 'Burj Khalifa' },
  { country: 'Iran',                   continent: 'Asia', aliases: [],                                article: 'Nasir al-Mulk Mosque' },
  { country: 'Pakistan',               continent: 'Asia', aliases: [],                                article: 'K2' },
  { country: 'Myanmar',                continent: 'Asia', aliases: ['burma'],                         article: 'Bagan' },
  { country: 'Sri Lanka',              continent: 'Asia', aliases: [],                                article: 'Sigiriya' },
  { country: 'Bhutan',                 continent: 'Asia', aliases: [],                                article: 'Tiger\'s Nest' },

  // ── AMERICAS ────────────────────────────────────────────────────────────────
  { country: 'United States', continent: 'Americas', aliases: ['usa','us','america'],  article: 'Grand Canyon' },
  { country: 'United States', continent: 'Americas', aliases: ['usa','us','america'],  article: 'Antelope Canyon' },
  { country: 'United States', continent: 'Americas', aliases: ['usa','us','america'],  article: 'Monument Valley' },
  { country: 'United States', continent: 'Americas', aliases: ['usa','us','america'],  article: 'Yosemite Valley' },
  { country: 'Canada',        continent: 'Americas', aliases: [],                      article: 'Moraine Lake' },
  { country: 'Canada',        continent: 'Americas', aliases: [],                      article: 'Château Frontenac' },
  { country: 'Canada',        continent: 'Americas', aliases: [],                      article: 'Banff National Park' },
  { country: 'Brazil',        continent: 'Americas', aliases: ['brasil'],              article: 'Iguazu Falls' },
  { country: 'Brazil',        continent: 'Americas', aliases: ['brasil'],              article: 'Amazon rainforest' },
  { country: 'Argentina',     continent: 'Americas', aliases: [],                      article: 'Perito Moreno Glacier' },
  { country: 'Argentina',     continent: 'Americas', aliases: [],                      article: 'Patagonia' },
  { country: 'Mexico',        continent: 'Americas', aliases: [],                      article: 'Chichen Itza' },
  { country: 'Mexico',        continent: 'Americas', aliases: [],                      article: 'Copper Canyon' },
  { country: 'Peru',          continent: 'Americas', aliases: [],                      article: 'Machu Picchu' },
  { country: 'Peru',          continent: 'Americas', aliases: [],                      article: 'Rainbow Mountain, Peru' },
  { country: 'Chile',         continent: 'Americas', aliases: [],                      article: 'Atacama Desert' },
  { country: 'Chile',         continent: 'Americas', aliases: [],                      article: 'Torres del Paine' },
  { country: 'Colombia',      continent: 'Americas', aliases: [],                      article: 'Caño Cristales' },
  { country: 'Cuba',          continent: 'Americas', aliases: [],                      article: 'Old Havana' },
  { country: 'Bolivia',       continent: 'Americas', aliases: [],                      article: 'Salar de Uyuni' },
  { country: 'Ecuador',       continent: 'Americas', aliases: [],                      article: 'Galápagos Islands' },

  // ── AFRICA ──────────────────────────────────────────────────────────────────
  { country: 'Morocco',       continent: 'Africa', aliases: [],  article: 'Chefchaouen' },
  { country: 'Morocco',       continent: 'Africa', aliases: [],  article: 'Sahara' },
  { country: 'Egypt',         continent: 'Africa', aliases: [],  article: 'Great Pyramid of Giza' },
  { country: 'Egypt',         continent: 'Africa', aliases: [],  article: 'Abu Simbel temples' },
  { country: 'South Africa',  continent: 'Africa', aliases: [],  article: 'Table Mountain' },
  { country: 'South Africa',  continent: 'Africa', aliases: [],  article: 'Blyde River Canyon' },
  { country: 'Kenya',         continent: 'Africa', aliases: [],  article: 'Maasai Mara' },
  { country: 'Tanzania',      continent: 'Africa', aliases: [],  article: 'Mount Kilimanjaro' },
  { country: 'Tanzania',      continent: 'Africa', aliases: [],  article: 'Serengeti National Park' },
  { country: 'Ethiopia',      continent: 'Africa', aliases: [],  article: 'Rock-hewn churches, Lalibela' },
  { country: 'Madagascar',    continent: 'Africa', aliases: [],  article: 'Avenue of the Baobabs' },
  { country: 'Namibia',       continent: 'Africa', aliases: [],  article: 'Sossusvlei' },
  { country: 'Zimbabwe',      continent: 'Africa', aliases: [],  article: 'Victoria Falls' },
  { country: 'Rwanda',        continent: 'Africa', aliases: [],  article: 'Volcanoes National Park, Rwanda' },

  // ── OCEANIA ─────────────────────────────────────────────────────────────────
  { country: 'Australia',     continent: 'Oceania', aliases: ['oz'], article: 'Uluru' },
  { country: 'Australia',     continent: 'Oceania', aliases: ['oz'], article: 'Great Barrier Reef' },
  { country: 'Australia',     continent: 'Oceania', aliases: ['oz'], article: 'Sydney Opera House' },
  { country: 'New Zealand',   continent: 'Oceania', aliases: ['nz'], article: 'Milford Sound' },
  { country: 'New Zealand',   continent: 'Oceania', aliases: ['nz'], article: 'Tongariro Alpine Crossing' },
];

// ─── WIKIPEDIA IMAGE FETCH ───────────────────────────────────────────────────

function fetchWikiImage(articleTitle) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(articleTitle.replace(/ /g, '_'));
    const options = {
      hostname: 'en.wikipedia.org',
      path: `/api/rest_v1/page/summary/${encoded}`,
      headers: {
        'User-Agent': 'MilkBot-Discord/1.0 (Discord bot; educational use)',
        'Accept': 'application/json',
      },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Prefer original full image; fall back to thumbnail. Bump thumbnail to 800px.
          let url = json.originalimage?.source || json.thumbnail?.source;
          if (url && json.thumbnail?.source && !json.originalimage) {
            url = json.thumbnail.source.replace(/\/\d+px-/, '/800px-');
          }
          resolve(url || null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ─── GAME LOGIC ─────────────────────────────────────────────────────────────

let activeGeo = null;

function isCorrect(guess, loc) {
  const g = guess.toLowerCase().trim();
  if (g === loc.country.toLowerCase()) return true;
  if (loc.aliases && loc.aliases.some(a => g === a.toLowerCase())) return true;
  return false;
}

function buildEmbed(loc, imageUrl, { hint = false, timedOut = false, winner = null, bonuses = '' } = {}) {
  let description = `Type the **country name** in chat. First correct answer wins **${REWARD} milk bucks**! 🥛`;

  if (hint) {
    description += `\n\n💡 **Hint:** Located in **${loc.continent}**`;
  }
  if (timedOut) {
    description = `⏰ Time's up! The answer was **${loc.country}** *(${loc.continent})*.`;
  }
  if (winner) {
    description = `✅ **${winner}** got it! The country was **${loc.country}**.\n+**${REWARD} milk bucks**!${bonuses ? ` *(${bonuses})*` : ''} 🥛`;
  }

  const color = timedOut ? 0xff4444 : winner ? 0x44ff88 : 0x3399ff;
  const footer = timedOut || winner ? '— Moo Geo Guesser' : 'You have 30 seconds · Hint drops at 15s';

  const embed = new EmbedBuilder()
    .setTitle('🌍  WHERE IN THE WORLD?  🌍')
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: footer });

  if (imageUrl) embed.setImage(imageUrl);

  return embed;
}

function check(message) {
  if (!activeGeo) return false;
  if (message.content.startsWith('!')) return false;

  const guess = message.content.trim();
  if (!guess || guess.length > 60) return false;
  if (!isCorrect(guess, activeGeo.loc)) return false;

  // Correct!
  const userId   = message.author.id;
  const username = message.author.username;
  clearTimeout(activeGeo.timeout);
  clearTimeout(activeGeo.hintTimeout);
  const { loc, imageUrl, gameMsg } = activeGeo;
  activeGeo = null;

  const newStreak = ws.recordWin(userId);
  const hotMul    = newStreak >= 3 ? 1.5 : 1;
  const pm        = prestige.getMultiplier(userId);
  const reward    = Math.floor(REWARD * hotMul * pm);
  const xpGain    = Math.floor(XP_REWARD * (state.doubleXp ? 2 : 1) * hotMul * pm);

  const balances = getData(balancesPath);
  balances[userId] = (balances[userId] || 0) + reward;
  saveData(balancesPath, balances);

  const xp = getData(xpPath);
  xp[userId] = (xp[userId] || 0) + xpGain;
  saveData(xpPath, xp);

  const bonuses = [hotMul > 1 ? '🔥 1.5x streak' : '', pm > 1 ? `🌟 ${pm}x prestige` : ''].filter(Boolean).join(' · ');

  const winEmbed = buildEmbed(loc, imageUrl, { winner: username, bonuses });
  if (gameMsg) gameMsg.edit({ embeds: [winEmbed] }).catch(() => {});

  if (newStreak >= 3) ws.announceStreak(message.channel, username, newStreak);
  jackpot.tryJackpot(userId, username, message.channel);
  ach.check(userId, username, 'game_win', { balance: balances[userId], xp: xp[userId], streak: newStreak, gameType: 'geo' }, message.channel);

  return true;
}

module.exports = {
  name: 'geo',
  aliases: ['geoguesser', 'geoguessr'],
  description: 'Guess the country from a real-world photo. First correct answer wins 50 milk bucks.',
  check,
  async execute(message) {
    if (activeGeo) {
      return message.reply(`A geo round is already active! Guess the country. 🌍`);
    }

    const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

    jackpot.addToJackpot(10);

    // Fetch image from Wikipedia API
    const imageUrl = await fetchWikiImage(loc.article);
    if (!imageUrl) {
      return message.reply(`couldn't load an image right now. try again in a sec. 🌍`);
    }

    const initEmbed = buildEmbed(loc, imageUrl);
    const gameMsg = await message.channel.send({ embeds: [initEmbed] }).catch(console.error);

    const hintTimeout = setTimeout(() => {
      if (!activeGeo) return;
      const hintEmbed = buildEmbed(loc, imageUrl, { hint: true });
      if (gameMsg) gameMsg.edit({ embeds: [hintEmbed] }).catch(() => {});
    }, HINT_TIME);

    const timeout = setTimeout(() => {
      if (!activeGeo) return;
      activeGeo = null;
      const timeoutEmbed = buildEmbed(loc, imageUrl, { timedOut: true });
      if (gameMsg) gameMsg.edit({ embeds: [timeoutEmbed] }).catch(() => {});
    }, GAME_TIME);

    activeGeo = { loc, imageUrl, timeout, hintTimeout, gameMsg };
  },
};
