const fs = require('fs');
const path = require('path');
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
// Images sourced from Wikimedia Commons (CC licensed, freely embeddable).
// Each entry: { country, continent, url, aliases? }

const LOCATIONS = [

  // ── EUROPE ──────────────────────────────────────────────────────────────────
  {
    country: 'Norway', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/SW_-_Geirangerfjord.jpg/800px-SW_-_Geirangerfjord.jpg',
  },
  {
    country: 'Iceland', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/ESC_large_ISS022_ISS022-E-11387-edit_01.JPG/800px-ESC_large_ISS022_ISS022-E-11387-edit_01.JPG',
  },
  {
    country: 'Switzerland', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Swiss_National_Park_131.jpg/800px-Swiss_National_Park_131.jpg',
  },
  {
    country: 'Italy', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Tuscany_Landscape_1.jpg/800px-Tuscany_Landscape_1.jpg',
  },
  {
    country: 'Greece', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Santorini_Ia.jpg/800px-Santorini_Ia.jpg',
  },
  {
    country: 'France', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Lavender_field_in_Provence.jpg/800px-Lavender_field_in_Provence.jpg',
  },
  {
    country: 'Netherlands', continent: 'Europe', aliases: ['holland'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Keukenhof_-_panoramio.jpg/800px-Keukenhof_-_panoramio.jpg',
  },
  {
    country: 'Germany', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Neuschwanstein_Castle_SW_view.jpg/800px-Neuschwanstein_Castle_SW_view.jpg',
  },
  {
    country: 'Spain', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Sagrada_Familia_01.jpg/800px-Sagrada_Familia_01.jpg',
  },
  {
    country: 'Portugal', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Lissabon%2C_Alfama_%28Lisboa%2C_Portugal%2C_2012%29.jpg/800px-Lissabon%2C_Alfama_%28Lisboa%2C_Portugal%2C_2012%29.jpg',
  },
  {
    country: 'United Kingdom', continent: 'Europe', aliases: ['uk', 'britain', 'england', 'scotland', 'wales'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/All_Souls_College%2C_Oxford_University%2C_UK_-_Diliff.jpg/800px-All_Souls_College%2C_Oxford_University%2C_UK_-_Diliff.jpg',
  },
  {
    country: 'Ireland', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/24701-nature-natural-beauty-of-ireland.jpg/800px-24701-nature-natural-beauty-of-ireland.jpg',
  },
  {
    country: 'Czech Republic', continent: 'Europe', aliases: ['czechia'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Prague_-_Hradcany_Castle_-_0414.jpg/800px-Prague_-_Hradcany_Castle_-_0414.jpg',
  },
  {
    country: 'Austria', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Hallst%C3%A4tter_See_Hausberge.jpg/800px-Hallst%C3%A4tter_See_Hausberge.jpg',
  },
  {
    country: 'Hungary', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Budapest_-_Parliament_Building_at_dusk.jpg/800px-Budapest_-_Parliament_Building_at_dusk.jpg',
  },
  {
    country: 'Poland', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Krakow_-_Stare_Miasto.jpg/800px-Krakow_-_Stare_Miasto.jpg',
  },
  {
    country: 'Croatia', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Dubrovnik_-_Vue_g%C3%A9n%C3%A9rale.jpg/800px-Dubrovnik_-_Vue_g%C3%A9n%C3%A9rale.jpg',
  },
  {
    country: 'Sweden', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Gamla_Stan_from_Katarina_elevator_%28cropped%29.jpg/800px-Gamla_Stan_from_Katarina_elevator_%28cropped%29.jpg',
  },
  {
    country: 'Finland', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Finland_-_Lakeland.jpg/800px-Finland_-_Lakeland.jpg',
  },
  {
    country: 'Romania', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Bran_Castle.jpg/800px-Bran_Castle.jpg',
  },
  {
    country: 'Russia', continent: 'Europe', aliases: ['russian federation'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Moscow_July_2011-12.jpg/800px-Moscow_July_2011-12.jpg',
  },
  {
    country: 'Ukraine', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Kiev_Pechersk_Lavra_DSC_4898_71-101-0001.jpg/800px-Kiev_Pechersk_Lavra_DSC_4898_71-101-0001.jpg',
  },
  {
    country: 'Turkey', continent: 'Europe', aliases: ['türkiye'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Cappadocia_Balloon_Inflating.jpg/800px-Cappadocia_Balloon_Inflating.jpg',
  },
  {
    country: 'Belgium', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Bruges_-_Panorama_from_the_Belfort.jpg/800px-Bruges_-_Panorama_from_the_Belfort.jpg',
  },
  {
    country: 'Denmark', continent: 'Europe', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Nyhavn_in_Copenhagen.jpg/800px-Nyhavn_in_Copenhagen.jpg',
  },

  // ── ASIA ────────────────────────────────────────────────────────────────────
  {
    country: 'Japan', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Kitano-Tenmangu5272.jpg/800px-Kitano-Tenmangu5272.jpg',
  },
  {
    country: 'Japan', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/20190404_Oishi_Park%2C_Mount_Fuji_09.jpg/800px-20190404_Oishi_Park%2C_Mount_Fuji_09.jpg',
  },
  {
    country: 'China', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/万里长城-戚晓慧.jpg/800px-万里长城-戚晓慧.jpg',
  },
  {
    country: 'South Korea', continent: 'Asia', aliases: ['korea'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Gyeongbokgung.jpg/800px-Gyeongbokgung.jpg',
  },
  {
    country: 'India', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/TajMahal_2012.jpg/800px-TajMahal_2012.jpg',
  },
  {
    country: 'India', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Jaipur_03-2016_16_Hawa_Mahal.jpg/800px-Jaipur_03-2016_16_Hawa_Mahal.jpg',
  },
  {
    country: 'Vietnam', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Ha_Long_Bay_%28Vịnh_Hạ_Long%29%2C_Quảng_Ninh%2C_Vietnam_-_panoramio_%281%29.jpg/800px-Ha_Long_Bay_%28Vịnh_Hạ_Long%29%2C_Quảng_Ninh%2C_Vietnam_-_panoramio_%281%29.jpg',
  },
  {
    country: 'Thailand', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Wat_Phra_Kaew%2C_Bangkok%2C_01.jpg/800px-Wat_Phra_Kaew%2C_Bangkok%2C_01.jpg',
  },
  {
    country: 'Indonesia', continent: 'Asia', aliases: ['bali'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Bali_Indonesia_%28Pura_Ulun_Danu_Bratan_Temple%29.jpg/800px-Bali_Indonesia_%28Pura_Ulun_Danu_Bratan_Temple%29.jpg',
  },
  {
    country: 'Nepal', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg/800px-Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg',
  },
  {
    country: 'Philippines', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Chocolate_Hills_overview.JPG/800px-Chocolate_Hills_overview.JPG',
  },
  {
    country: 'Malaysia', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Petronas_Twin_Tower.jpg/800px-Petronas_Twin_Tower.jpg',
  },
  {
    country: 'Cambodia', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Angkor_Wat%2C_Camboya%2C_2013-08-16%2C_DD_51.JPG/800px-Angkor_Wat%2C_Camboya%2C_2013-08-16%2C_DD_51.JPG',
  },
  {
    country: 'Mongolia', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Ger_on_the_grasslands.jpg/800px-Ger_on_the_grasslands.jpg',
  },
  {
    country: 'Jordan', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Petra_Jordan_BW_21.JPG/800px-Petra_Jordan_BW_21.JPG',
  },
  {
    country: 'Israel', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Jerusalem-2013-Aerial-Temple_Mount-02.jpg/800px-Jerusalem-2013-Aerial-Temple_Mount-02.jpg',
  },
  {
    country: 'Saudi Arabia', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Masjid_al-Haram%2C_Mecca%2C_Saudi_Arabia.jpg/800px-Masjid_al-Haram%2C_Mecca%2C_Saudi_Arabia.jpg',
  },
  {
    country: 'United Arab Emirates', continent: 'Asia', aliases: ['uae', 'emirates', 'dubai'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Dubai_Marina_Skyline.jpg/800px-Dubai_Marina_Skyline.jpg',
  },
  {
    country: 'Pakistan', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Lahore_Fort_-_Sheesh_Mahal.jpg/800px-Lahore_Fort_-_Sheesh_Mahal.jpg',
  },
  {
    country: 'Iran', continent: 'Asia', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Nasir_al-Mulk_mosque_detail.jpg/800px-Nasir_al-Mulk_mosque_detail.jpg',
  },

  // ── AMERICAS ────────────────────────────────────────────────────────────────
  {
    country: 'United States', continent: 'Americas', aliases: ['usa', 'us', 'america'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Manhattan_at_Dusk_by_Dan_Nguyen_%40_flickr.jpg/800px-Manhattan_at_Dusk_by_Dan_Nguyen_%40_flickr.jpg',
  },
  {
    country: 'United States', continent: 'Americas', aliases: ['usa', 'us', 'america'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Empire_State_Building_%28aerial_view%29.jpg/800px-Empire_State_Building_%28aerial_view%29.jpg',
  },
  {
    country: 'United States', continent: 'Americas', aliases: ['usa', 'us', 'america'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Grand_Canyon_from_South_rim_2010.jpg/800px-Grand_Canyon_from_South_rim_2010.jpg',
  },
  {
    country: 'Canada', continent: 'Americas', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Canada_-_Quebec_City_-_Chateau_Frontenac_%281%29.jpg/800px-Canada_-_Quebec_City_-_Chateau_Frontenac_%281%29.jpg',
  },
  {
    country: 'Canada', continent: 'Americas', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Moraine_Lake_17092005.jpg/800px-Moraine_Lake_17092005.jpg',
  },
  {
    country: 'Brazil', continent: 'Americas', aliases: ['brasil'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Rio_de_Janeiro-panorama_da_cidade.jpg/800px-Rio_de_Janeiro-panorama_da_cidade.jpg',
  },
  {
    country: 'Brazil', continent: 'Americas', aliases: ['brasil'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Pantanal_Matogrossense_National_Park_-_Brasil.jpg/800px-Pantanal_Matogrossense_National_Park_-_Brasil.jpg',
  },
  {
    country: 'Argentina', continent: 'Americas', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Perito_Moreno_Glacier_Patagonia_Argentina_Luca_Galuzzi_2005.JPG/800px-Perito_Moreno_Glacier_Patagonia_Argentina_Luca_Galuzzi_2005.JPG',
  },
  {
    country: 'Mexico', continent: 'Americas', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Chichen_Itza_3.jpg/800px-Chichen_Itza_3.jpg',
  },
  {
    country: 'Peru', continent: 'Americas', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Machu_Picchu%2C_Peru.jpg/800px-Machu_Picchu%2C_Peru.jpg',
  },
  {
    country: 'Chile', continent: 'Americas', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Atacama_Desert.jpg/800px-Atacama_Desert.jpg',
  },
  {
    country: 'Colombia', continent: 'Americas', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Cartagena_de_Indias_-_panoramio.jpg/800px-Cartagena_de_Indias_-_panoramio.jpg',
  },
  {
    country: 'Cuba', continent: 'Americas', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Havana-view-from-faro.jpg/800px-Havana-view-from-faro.jpg',
  },
  {
    country: 'Bolivia', continent: 'Americas', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Salar_de_Uyuni_2.jpg/800px-Salar_de_Uyuni_2.jpg',
  },

  // ── AFRICA ──────────────────────────────────────────────────────────────────
  {
    country: 'Morocco', continent: 'Africa', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Marrakech_Medina.jpg/800px-Marrakech_Medina.jpg',
  },
  {
    country: 'Egypt', continent: 'Africa', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kheops-Pyramid.jpg/800px-Kheops-Pyramid.jpg',
  },
  {
    country: 'Egypt', continent: 'Africa', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Abu_Simbel%2C_Egypt%2C_Oct_2004.jpg/800px-Abu_Simbel%2C_Egypt%2C_Oct_2004.jpg',
  },
  {
    country: 'South Africa', continent: 'Africa', aliases: ['south africa'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Table_Mountain_DanieVDM.jpg/800px-Table_Mountain_DanieVDM.jpg',
  },
  {
    country: 'South Africa', continent: 'Africa', aliases: ['south africa'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Cape_Town_Aerial_-_Flickr_-_David_Broad.jpg/800px-Cape_Town_Aerial_-_Flickr_-_David_Broad.jpg',
  },
  {
    country: 'Kenya', continent: 'Africa', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Masaai_Mara_Lion.JPG/800px-Masaai_Mara_Lion.JPG',
  },
  {
    country: 'Tanzania', continent: 'Africa', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Mt._Kilimanjaro_12.2006.JPG/800px-Mt._Kilimanjaro_12.2006.JPG',
  },
  {
    country: 'Ethiopia', continent: 'Africa', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Lalibela_Ethiopia_Bete_Giyorgis.jpg/800px-Lalibela_Ethiopia_Bete_Giyorgis.jpg',
  },
  {
    country: 'Madagascar', continent: 'Africa', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/All%C3%A9e_des_Baobabs_au_coucher_du_soleil%2C_Madagascar.jpg/800px-All%C3%A9e_des_Baobabs_au_coucher_du_soleil%2C_Madagascar.jpg',
  },
  {
    country: 'Nigeria', continent: 'Africa', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Lagos_skyline.jpg/800px-Lagos_skyline.jpg',
  },
  {
    country: 'Ghana', continent: 'Africa', aliases: [],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Cape_Coast_Castle.jpg/800px-Cape_Coast_Castle.jpg',
  },

  // ── OCEANIA ─────────────────────────────────────────────────────────────────
  {
    country: 'Australia', continent: 'Oceania', aliases: ['oz'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Uluru%2C_helicopter_view%2C_cropped.jpg/800px-Uluru%2C_helicopter_view%2C_cropped.jpg',
  },
  {
    country: 'Australia', continent: 'Oceania', aliases: ['oz'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Sydney_Opera_House_and_Harbour_Bridge_Dusk_%282%29_crop.jpg/800px-Sydney_Opera_House_and_Harbour_Bridge_Dusk_%282%29_crop.jpg',
  },
  {
    country: 'New Zealand', continent: 'Oceania', aliases: ['nz'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Waikato_river_sunset_03.jpg/800px-Waikato_river_sunset_03.jpg',
  },
  {
    country: 'New Zealand', continent: 'Oceania', aliases: ['nz'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/New_Zealand_Fiordland_Milford_Sound.jpg/800px-New_Zealand_Fiordland_Milford_Sound.jpg',
  },
  {
    country: 'Papua New Guinea', continent: 'Oceania', aliases: ['png'],
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Kokoda_Track_Isurava.jpg/800px-Kokoda_Track_Isurava.jpg',
  },
];

// ─── GAME LOGIC ─────────────────────────────────────────────────────────────

let activeGeo = null;

function normalize(str) {
  return str.toLowerCase().trim();
}

function isCorrect(guess, loc) {
  const g = normalize(guess);
  if (g === normalize(loc.country)) return true;
  if (loc.aliases && loc.aliases.some(a => g === a.toLowerCase())) return true;
  return false;
}

function buildEmbed(loc, { hint = false, timedOut = false, winner = null } = {}) {
  let description = `Type the **country name** in chat. First correct answer wins **${REWARD} milk bucks**! 🥛`;

  if (hint) {
    description += `\n\n💡 **Hint:** Located in **${loc.continent}**`;
  }
  if (timedOut) {
    description = `⏰ Time's up! Nobody got it. The answer was **${loc.country}** ${loc.continent ? `*(${loc.continent})*` : ''}.`;
  }
  if (winner) {
    description = `✅ **${winner}** got it! The country was **${loc.country}**.\n+**${REWARD} milk bucks**! 🥛`;
  }

  const color = timedOut ? 0xff4444 : winner ? 0x44ff88 : 0x3399ff;

  return new EmbedBuilder()
    .setTitle('🌍  WHERE IN THE WORLD?  🌍')
    .setDescription(description)
    .setImage(loc.url)
    .setColor(color)
    .setFooter({ text: timedOut || winner ? '— Moo Geo Guesser' : 'You have 30 seconds · Hint drops at 15s' });
}

function check(message) {
  if (!activeGeo) return false;
  if (message.content.startsWith('!')) return false;

  const guess = message.content.trim();
  if (!guess || guess.length > 60) return false;

  if (!isCorrect(guess, activeGeo.loc)) {
    // Wrong guess — don't consume the message, let it sit
    return false;
  }

  // Correct!
  const userId   = message.author.id;
  const username = message.author.username;
  clearTimeout(activeGeo.timeout);
  clearTimeout(activeGeo.hintTimeout);
  const loc = activeGeo.loc;
  const gameMsg = activeGeo.gameMsg;
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

  const winEmbed = buildEmbed(loc, { winner: username });
  if (bonuses) winEmbed.setFooter({ text: bonuses });
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
      return message.reply(`A geo round is already active! Take a look and guess the country. 🌍`);
    }

    const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

    jackpot.addToJackpot(10);

    const initEmbed = buildEmbed(loc);
    const gameMsg = await message.channel.send({ embeds: [initEmbed] }).catch(console.error);

    const hintTimeout = setTimeout(() => {
      if (!activeGeo) return;
      const hintEmbed = buildEmbed(loc, { hint: true });
      if (gameMsg) gameMsg.edit({ embeds: [hintEmbed] }).catch(() => {});
    }, HINT_TIME);

    const timeout = setTimeout(() => {
      if (!activeGeo) return;
      activeGeo = null;
      const timeoutEmbed = buildEmbed(loc, { timedOut: true });
      if (gameMsg) gameMsg.edit({ embeds: [timeoutEmbed] }).catch(() => {});
    }, GAME_TIME);

    activeGeo = { loc, timeout, hintTimeout, gameMsg };
  },
};
