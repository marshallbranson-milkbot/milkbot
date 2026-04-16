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
  { country: 'France',         continent: 'Europe',   aliases: [],                                   article: 'Eiffel Tower' },
  { country: 'France',         continent: 'Europe',   aliases: [],                                   article: 'Mont Saint-Michel' },
  { country: 'France',         continent: 'Europe',   aliases: [],                                   article: 'Palace of Versailles' },
  { country: 'Italy',          continent: 'Europe',   aliases: [],                                   article: 'Colosseum' },
  { country: 'Italy',          continent: 'Europe',   aliases: [],                                   article: 'Leaning Tower of Pisa' },
  { country: 'Italy',          continent: 'Europe',   aliases: [],                                   article: 'Amalfi Coast' },
  { country: 'Italy',          continent: 'Europe',   aliases: [],                                   article: 'Trevi Fountain' },
  { country: 'Greece',         continent: 'Europe',   aliases: [],                                   article: 'Santorini' },
  { country: 'Greece',         continent: 'Europe',   aliases: [],                                   article: 'Acropolis of Athens' },
  { country: 'Greece',         continent: 'Europe',   aliases: [],                                   article: 'Meteora' },
  { country: 'Spain',          continent: 'Europe',   aliases: [],                                   article: 'Sagrada Família' },
  { country: 'Spain',          continent: 'Europe',   aliases: [],                                   article: 'Alhambra' },
  { country: 'Portugal',       continent: 'Europe',   aliases: [],                                   article: 'Sintra' },
  { country: 'Germany',        continent: 'Europe',   aliases: [],                                   article: 'Neuschwanstein Castle' },
  { country: 'Switzerland',    continent: 'Europe',   aliases: [],                                   article: 'Matterhorn' },
  { country: 'Austria',        continent: 'Europe',   aliases: [],                                   article: 'Hallstatt' },
  { country: 'Hungary',        continent: 'Europe',   aliases: [],                                   article: 'Hungarian Parliament Building' },
  { country: 'Romania',        continent: 'Europe',   aliases: [],                                   article: 'Bran Castle' },
  { country: 'Russia',         continent: 'Europe',   aliases: ['russian federation'],               article: "Saint Basil's Cathedral" },
  { country: 'Turkey',         continent: 'Europe',   aliases: ['türkiye'],                          article: 'Cappadocia' },
  { country: 'Turkey',         continent: 'Europe',   aliases: ['türkiye'],                          article: 'Hagia Sophia' },
  { country: 'Netherlands',    continent: 'Europe',   aliases: ['holland'],                          article: 'Kinderdijk' },
  { country: 'Belgium',        continent: 'Europe',   aliases: [],                                   article: 'Bruges' },
  { country: 'Denmark',        continent: 'Europe',   aliases: [],                                   article: 'Nyhavn' },
  { country: 'United Kingdom', continent: 'Europe',   aliases: ['uk','britain','england'],           article: 'Stonehenge' },
  { country: 'United Kingdom', continent: 'Europe',   aliases: ['uk','britain','england'],           article: 'Tower Bridge' },
  { country: 'Ireland',        continent: 'Europe',   aliases: [],                                   article: 'Cliffs of Moher' },
  { country: 'Czech Republic', continent: 'Europe',   aliases: ['czechia'],                          article: 'Prague Castle' },
  { country: 'Croatia',        continent: 'Europe',   aliases: [],                                   article: 'Dubrovnik' },
  { country: 'Croatia',        continent: 'Europe',   aliases: [],                                   article: 'Plitvice Lakes National Park' },
  { country: 'Norway',         continent: 'Europe',   aliases: [],                                   article: 'Trolltunga' },
  { country: 'Norway',         continent: 'Europe',   aliases: [],                                   article: 'Geirangerfjord' },
  { country: 'Iceland',        continent: 'Europe',   aliases: [],                                   article: 'Jökulsárlón' },
  { country: 'Iceland',        continent: 'Europe',   aliases: [],                                   article: 'Skógafoss' },
  { country: 'Sweden',         continent: 'Europe',   aliases: [],                                   article: 'Stockholm City Hall' },
  { country: 'Poland',         continent: 'Europe',   aliases: [],                                   article: 'Wawel Castle' },
  { country: 'Ukraine',        continent: 'Europe',   aliases: [],                                   article: 'Kyiv Pechersk Lavra' },

  // ── ASIA ────────────────────────────────────────────────────────────────────
  { country: 'Japan',                continent: 'Asia', aliases: [],                               article: 'Mount Fuji' },
  { country: 'Japan',                continent: 'Asia', aliases: [],                               article: 'Fushimi Inari-taisha' },
  { country: 'China',                continent: 'Asia', aliases: [],                               article: 'Great Wall of China' },
  { country: 'China',                continent: 'Asia', aliases: [],                               article: 'Zhangjiajie National Forest Park' },
  { country: 'South Korea',          continent: 'Asia', aliases: ['korea'],                        article: 'Gyeongbokgung' },
  { country: 'India',                continent: 'Asia', aliases: [],                               article: 'Taj Mahal' },
  { country: 'India',                continent: 'Asia', aliases: [],                               article: 'Hawa Mahal' },
  { country: 'Vietnam',              continent: 'Asia', aliases: [],                               article: 'Hạ Long Bay' },
  { country: 'Thailand',             continent: 'Asia', aliases: [],                               article: 'Wat Phra Kaew' },
  { country: 'Indonesia',            continent: 'Asia', aliases: [],                               article: 'Borobudur' },
  { country: 'Indonesia',            continent: 'Asia', aliases: [],                               article: 'Pura Ulun Danu Bratan' },
  { country: 'Malaysia',             continent: 'Asia', aliases: [],                               article: 'Petronas Towers' },
  { country: 'Cambodia',             continent: 'Asia', aliases: [],                               article: 'Angkor Wat' },
  { country: 'Philippines',          continent: 'Asia', aliases: [],                               article: 'Chocolate Hills' },
  { country: 'Philippines',          continent: 'Asia', aliases: [],                               article: 'Banaue Rice Terraces' },
  { country: 'Jordan',               continent: 'Asia', aliases: [],                               article: 'Petra' },
  { country: 'Jordan',               continent: 'Asia', aliases: [],                               article: 'Wadi Rum' },
  { country: 'Israel',               continent: 'Asia', aliases: [],                               article: 'Dome of the Rock' },
  { country: 'United Arab Emirates', continent: 'Asia', aliases: ['uae','emirates','dubai'],       article: 'Burj Khalifa' },
  { country: 'Iran',                 continent: 'Asia', aliases: [],                               article: 'Nasir al-Mulk Mosque' },
  { country: 'Myanmar',              continent: 'Asia', aliases: ['burma'],                        article: 'Bagan' },
  { country: 'Sri Lanka',            continent: 'Asia', aliases: [],                               article: 'Sigiriya' },
  { country: 'Bhutan',               continent: 'Asia', aliases: [],                               article: "Tiger's Nest" },
  { country: 'Nepal',                continent: 'Asia', aliases: [],                               article: 'Swayambhunath' },

  // ── AMERICAS ────────────────────────────────────────────────────────────────
  { country: 'United States', continent: 'Americas', aliases: ['usa','us','america'],  article: 'Grand Canyon' },
  { country: 'United States', continent: 'Americas', aliases: ['usa','us','america'],  article: 'Statue of Liberty' },
  { country: 'United States', continent: 'Americas', aliases: ['usa','us','america'],  article: 'Golden Gate Bridge' },
  { country: 'United States', continent: 'Americas', aliases: ['usa','us','america'],  article: 'Antelope Canyon' },
  { country: 'United States', continent: 'Americas', aliases: ['usa','us','america'],  article: 'Monument Valley' },
  { country: 'Canada',        continent: 'Americas', aliases: [],                      article: 'Moraine Lake' },
  { country: 'Canada',        continent: 'Americas', aliases: [],                      article: 'Château Frontenac' },
  { country: 'Brazil',        continent: 'Americas', aliases: ['brasil'],              article: 'Christ the Redeemer (statue)' },
  { country: 'Brazil',        continent: 'Americas', aliases: ['brasil'],              article: 'Iguazu Falls' },
  { country: 'Mexico',        continent: 'Americas', aliases: [],                      article: 'Chichen Itza' },
  { country: 'Peru',          continent: 'Americas', aliases: [],                      article: 'Machu Picchu' },
  { country: 'Peru',          continent: 'Americas', aliases: [],                      article: 'Rainbow Mountain, Peru' },
  { country: 'Bolivia',       continent: 'Americas', aliases: [],                      article: 'Salar de Uyuni' },
  { country: 'Chile',         continent: 'Americas', aliases: [],                      article: 'Torres del Paine' },
  { country: 'Argentina',     continent: 'Americas', aliases: [],                      article: 'Perito Moreno Glacier' },
  { country: 'Cuba',          continent: 'Americas', aliases: [],                      article: 'Old Havana' },
  { country: 'Ecuador',       continent: 'Americas', aliases: [],                      article: 'Galápagos Islands' },
  { country: 'Colombia',      continent: 'Americas', aliases: [],                      article: 'Ciudad Perdida' },

  // ── AFRICA ──────────────────────────────────────────────────────────────────
  { country: 'Egypt',         continent: 'Africa', aliases: [],  article: 'Great Pyramid of Giza' },
  { country: 'Egypt',         continent: 'Africa', aliases: [],  article: 'Abu Simbel temples' },
  { country: 'Morocco',       continent: 'Africa', aliases: [],  article: 'Chefchaouen' },
  { country: 'Morocco',       continent: 'Africa', aliases: [],  article: 'Jardin Majorelle' },
  { country: 'South Africa',  continent: 'Africa', aliases: [],  article: 'Table Mountain' },
  { country: 'Tanzania',      continent: 'Africa', aliases: [],  article: 'Mount Kilimanjaro' },
  { country: 'Kenya',         continent: 'Africa', aliases: [],  article: 'Maasai Mara' },
  { country: 'Madagascar',    continent: 'Africa', aliases: [],  article: 'Avenue of the Baobabs' },
  { country: 'Namibia',       continent: 'Africa', aliases: [],  article: 'Sossusvlei' },
  { country: 'Zimbabwe',      continent: 'Africa', aliases: [],  article: 'Victoria Falls' },
  { country: 'Ethiopia',      continent: 'Africa', aliases: [],  article: 'Rock-hewn churches, Lalibela' },

  // ── OCEANIA ─────────────────────────────────────────────────────────────────
  { country: 'Australia',     continent: 'Oceania', aliases: ['oz'], article: 'Sydney Opera House' },
  { country: 'Australia',     continent: 'Oceania', aliases: ['oz'], article: 'Uluru' },
  { country: 'Australia',     continent: 'Oceania', aliases: ['oz'], article: 'Great Barrier Reef' },
  { country: 'New Zealand',   continent: 'Oceania', aliases: ['nz'], article: 'Milford Sound' },
  { country: 'New Zealand',   continent: 'Oceania', aliases: ['nz'], article: 'Tongariro Alpine Crossing' },
];

// ─── WIKIPEDIA IMAGE FETCH ───────────────────────────────────────────────────

// Step 1: get the image URL from Wikipedia's REST API
function fetchWikiImageUrl(articleTitle) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(articleTitle.replace(/ /g, '_'));
    https.get({
      hostname: 'en.wikipedia.org',
      path: `/api/rest_v1/page/summary/${encoded}`,
      headers: { 'User-Agent': 'MilkBot-Discord/1.0', 'Accept': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Use thumbnail URL exactly as returned — don't resize, avoids on-demand generation
          const thumb = json.thumbnail?.source;
          if (!thumb) {
            console.log(`[geo] no thumbnail for article: ${articleTitle}`);
            resolve(null); return;
          }
          // Skip map/diagram thumbnails — their filenames contain telltale patterns
          if (/location.?map|locator.?map|_map_|BlankMap|relief_map|flag_of|Flag_of/i.test(thumb)) {
            console.log(`[geo] thumbnail looks like a map or flag, skipping: ${articleTitle}`);
            resolve(null); return;
          }
          console.log(`[geo] image URL for "${articleTitle}": ${thumb}`);
          resolve(thumb);
        } catch (e) { console.log('[geo] fetchWikiImageUrl parse error:', e.message); resolve(null); }
      });
    }).on('error', (e) => { console.log('[geo] fetchWikiImageUrl request error:', e.message); resolve(null); });
  });
}

// Step 2: download the image bytes so we can upload directly to Discord.
// This bypasses Wikimedia's hotlink rate-limiting entirely.
function downloadImage(url, redirects = 0) {
  return new Promise((resolve) => {
    if (redirects > 5) { resolve(null); return; }
    https.get(url, { headers: { 'User-Agent': 'MilkBot-Discord/1.0' } }, (res) => {
      console.log(`[geo] download status: ${res.statusCode} (redirects: ${redirects})`);
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        res.resume();
        downloadImage(res.headers.location, redirects + 1).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        console.log(`[geo] downloaded ${buf.length} bytes`);
        resolve(buf);
      });
    }).on('error', (e) => { console.log('[geo] downloadImage error:', e.message); resolve(null); });
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

// cdnUrl = Discord CDN URL captured after first send (used for edits)
function buildEmbed(loc, cdnUrl, { hint = false, timedOut = false, winner = null, bonuses = '', initial = false } = {}) {
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

  // On initial send we reference the attachment; on edits we use the Discord CDN URL
  if (initial) {
    embed.setImage('attachment://geo.jpg');
  } else if (cdnUrl) {
    embed.setImage(cdnUrl);
  }

  return embed;
}

function check(message) {
  if (!activeGeo) return false;
  if (message.content.startsWith('!')) return false;

  const guess = message.content.trim();
  if (!guess || guess.length > 60) return false;

  // Delete every guess attempt during an active geo game
  message.delete().catch(() => {});

  if (!isCorrect(guess, activeGeo.loc)) return true; // wrong — consumed and deleted

  // Correct!
  const userId   = message.author.id;
  const username = message.author.username;
  clearTimeout(activeGeo.timeout);
  clearTimeout(activeGeo.hintTimeout);
  const { loc, cdnUrl, gameMsg } = activeGeo;
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

  const winEmbed = buildEmbed(loc, cdnUrl, { winner: username, bonuses });
  if (gameMsg) {
    gameMsg.edit({ embeds: [winEmbed] }).catch(() => {});
    setTimeout(() => gameMsg.delete().catch(() => {}), 8000);
  }

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
    if (activeGeo) return; // already active, silently ignore

    const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

    jackpot.addToJackpot(10);

    // Get Wikipedia image URL, then download the bytes so we can upload
    // directly to Discord — bypasses Wikimedia's hotlink rate-limiting.
    const imageUrl = await fetchWikiImageUrl(loc.article);
    if (!imageUrl) {
      return message.reply(`couldn't load an image right now. try again in a sec. 🌍`);
    }
    const imageBuffer = await downloadImage(imageUrl);
    if (!imageBuffer) {
      return message.reply(`couldn't load an image right now. try again in a sec. 🌍`);
    }

    // Send with image attached; capture Discord's CDN URL for later edits
    const initEmbed = buildEmbed(loc, null, { initial: true });
    const gameMsg = await message.channel.send({
      embeds: [initEmbed],
      files: [{ attachment: imageBuffer, name: 'geo.jpg' }],
    }).catch(console.error);

    // Discord CDN URL — stable for the lifetime of the message
    const cdnUrl = gameMsg?.attachments?.first()?.url || null;

    const hintTimeout = setTimeout(() => {
      if (!activeGeo) return;
      const hintEmbed = buildEmbed(loc, cdnUrl, { hint: true });
      if (gameMsg) gameMsg.edit({ embeds: [hintEmbed] }).catch(() => {});
    }, HINT_TIME);

    const timeout = setTimeout(() => {
      if (!activeGeo) return;
      activeGeo = null;
      const timeoutEmbed = buildEmbed(loc, cdnUrl, { timedOut: true });
      if (gameMsg) {
        gameMsg.edit({ embeds: [timeoutEmbed] }).catch(() => {});
        setTimeout(() => gameMsg.delete().catch(() => {}), 8000);
      }
    }, GAME_TIME);

    activeGeo = { loc, cdnUrl, timeout, hintTimeout, gameMsg };
  },
};
