const fs = require('fs');
const path = require('path');
const GUILD_ID = '562076997979865118';
const state = require('./state');

const balancesPath = path.join(__dirname, 'data/balances.json');

const COMPANY_NAMES = {
  MILK:  'MilkCorp Industries',
  CREM:  'Creme Capital',
  BUTR:  'ButterCo Holdings',
  WHEY:  'Whey Street Group',
  MOO:   'Moo Markets Inc',
  CHUG:  'Chug Enterprises',
  GOT:   'Got Milk Global',
  SPOIL: 'Spoiled Rotten LLC',
};

function buildTipMessage(headline) {
  if (headline.effects.length === 0) {
    const msgs = [
      `👀 heard something big is dropping in the market soon. no idea what. probably nothing. maybe everything.`,
      `my contact at the dairy floor is acting sus. something's coming. i can't say what.`,
      `🤫 just... keep an eye on the market today. that's all i'll say.`,
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  // Find most impactful effect
  const tierWeight = { major_positive: 5, minor_positive: 4, none: 3, minor_negative: 2, major_negative: 1 };
  const main = [...headline.effects].sort((a, b) => Math.abs(tierWeight[b.tier] - 3) - Math.abs(tierWeight[a.tier] - 3))[0];

  const company = main.ticker === 'ALL' ? 'the whole market' : (COMPANY_NAMES[main.ticker] || main.ticker);

  const lines = {
    major_positive: [
      `🔥 okay i really shouldn't be telling you this but ${company} is about to have a MASSIVE day. act accordingly. delete this DM.`,
      `🤫 **insider tip:** something huge just broke for ${company}. the kind of news that moves numbers. you didn't hear it from me.`,
      `my guy at the dairy floor just texted me. ${company}. big. that's all i got. 🥛`,
    ],
    minor_positive: [
      `👀 heard whispers that ${company} is looking pretty good heading into the next tick. might be worth a peek.`,
      `not financial advice but... ${company} has some good news coming. just saying. 🥛`,
      `🤫 a little bird told me ${company} is trending up. could be worth knowing.`,
    ],
    none: [
      `heard some chatter about ${company} today. honestly couldn't tell if it was good or bad. probably nothing.`,
      `👀 my contact mentioned ${company}. sounded uncertain. take that however you want.`,
      `🤷 rumor has it something's happening with ${company}. market could go either way tbh.`,
    ],
    minor_negative: [
      `😬 don't panic but i'm hearing some not-great stuff about ${company}. might want to keep an eye on your holdings.`,
      `🤫 heads up — ${company} might be in for a rough patch real soon. not great, not terrible.`,
      `heard something concerning about ${company} from a reliable source. not saying anything, just... watch the ticker. 🥛`,
    ],
    major_negative: [
      `⚠️ okay this is bad. someone who knows things just told me ${company} is about to get COOKED. act fast. or don't. your milk bucks, not mine.`,
      `🚨 **WARNING:** insider info says ${company} is in serious trouble. the kind of trouble that tanks numbers. move accordingly.`,
      `i probably shouldn't say this but ${company} is about to have a really, really bad day. you heard nothing from me. 🥛`,
    ],
  };

  const pool = lines[main.tier] || lines.none;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function sendInsiderTip(client, headline) {
  if (!fs.existsSync(balancesPath)) return;
  const balances = JSON.parse(fs.readFileSync(balancesPath, 'utf8'));
  const players = Object.keys(balances).filter(id => balances[id] > 0);
  if (players.length === 0) return;

  const userId = players[Math.floor(Math.random() * players.length)];
  try {
    const user = await client.users.fetch(userId);
    await user.send(
      `🕵️ **INSIDER TIP** 🕵️\n\n` +
      buildTipMessage(headline) + `\n\n` +
      `*— MilkBot's anonymous source. Moo News drops soon. 📰*`
    );
  } catch (_) {
    // DMs disabled or user not found, silently skip
  }
}

// Tier magnitude ranges [min, max] — sign already encoded
const TIER = {
  major_positive: [0.20, 0.35],
  minor_positive: [0.08, 0.18],
  none:           [-0.03, 0.03],
  minor_negative: [-0.18, -0.08],
  major_negative: [-0.35, -0.20],
};

function rollTier(tier) {
  const [min, max] = TIER[tier];
  return min + Math.random() * (max - min);
}

// Read by stockdata.js on next price tick, then cleared
const pendingModifiers = {};

// ─── HEADLINES ────────────────────────────────────────────────────────────────
// effects: array of { ticker, tier }
// ticker 'ALL' = market-wide
// empty effects = red herring

const HEADLINES = [

  // ── MILK ──────────────────────────────────────────────────────────────────
  { text: "MilkCorp Industries reports the largest quarterly earnings in company history — CEO Gerald Holstein seen openly weeping tears of joy at the podium", effects: [{ ticker: 'MILK', tier: 'major_positive' }] },
  { text: "MilkCorp signs exclusive 50-year global supply deal with the Dairy UN, locking every competitor off prime shelf space worldwide", effects: [{ ticker: 'MILK', tier: 'major_positive' }] },
  { text: "MilkCorp Industries voted Most Trusted Beverage Corporation for the 12th consecutive year — rivals decline to comment", effects: [{ ticker: 'MILK', tier: 'major_positive' }] },
  { text: "MILK Q2 results beat expectations — CFO credits 'staying the course and not doing anything stupid for once'", effects: [{ ticker: 'MILK', tier: 'minor_positive' }] },
  { text: "MILK stock upgraded to 'udderly irresistible' by top Moo News analyst following a steady three-quarter growth streak", effects: [{ ticker: 'MILK', tier: 'minor_positive' }] },
  { text: "MilkCorp opens three new distribution hubs in the Northern Pasture Region, expanding reach into previously untapped territory", effects: [{ ticker: 'MILK', tier: 'minor_positive' }] },
  { text: "MilkCorp's new PureWhite product line sells out within 48 hours of launch — emergency restocking underway", effects: [{ ticker: 'MILK', tier: 'minor_positive' }] },
  { text: "MilkCorp settles long-running dispute with Creme Capital out of court, terms undisclosed but described as 'favorable to the right party'", effects: [{ ticker: 'MILK', tier: 'minor_positive' }] },
  { text: "MilkCorp Industries named official beverage of the 3rd Annual Dairy Olympics held in the Greater Pasture Region", effects: [{ ticker: 'MILK', tier: 'minor_positive' }] },
  { text: "Consumer confidence in MILK brand hits five-year high following independent blind taste test that nobody asked for but everyone appreciated", effects: [{ ticker: 'MILK', tier: 'minor_positive' }] },
  { text: "MilkCorp misses Q3 earnings by narrow margin, blames 'unexpected cow behavior' in official quarterly filing", effects: [{ ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "MILK distribution delays reported across Eastern Pasture Region amid unresolved logistics disputes with regional partners", effects: [{ ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "MilkCorp faces class action lawsuit claiming their 'premium' product is just regular milk in a more expensive bottle", effects: [{ ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "MilkCorp VP of Operations resigns citing 'philosophical differences regarding the fundamental nature of milk'", effects: [{ ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "MILK brand suffers social media backlash after tone-deaf ad campaign featuring a visibly unhappy cow", effects: [{ ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "MilkCorp loses major government contract to unnamed competitor, describes loss as 'a temporary setback we fully anticipated'", effects: [{ ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "MilkCorp warehouse fire destroys estimated 40,000 units in Southern District facility — cause under investigation", effects: [{ ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "MilkCorp CEO Gerald Holstein arrested at the Annual Dairy Conference for alleged falsification of freshness records dating back to 2019", effects: [{ ticker: 'MILK', tier: 'major_negative' }] },
  { text: "Leaked internal memo reveals MilkCorp has been diluting product with 'non-dairy adjacent liquid' for 18 months — Dairy Bureau furious", effects: [{ ticker: 'MILK', tier: 'major_negative' }] },
  { text: "MilkCorp Industries hit with $2.3 billion regulatory fine after Dairy UN probe uncovers systemic quality control failures across all facilities", effects: [{ ticker: 'MILK', tier: 'major_negative' }] },

  // ── BUTR ──────────────────────────────────────────────────────────────────
  { text: "ButterCo Holdings announces surprise merger with the Northern Spread Alliance, creating the world's largest spreadable fats conglomerate overnight", effects: [{ ticker: 'BUTR', tier: 'major_positive' }] },
  { text: "BUTR posts best quarter in company history after viral 'butter everything' social media trend drives unprecedented consumer demand", effects: [{ ticker: 'BUTR', tier: 'major_positive' }] },
  { text: "ButterCo Holdings wins landmark government contract to supply all Dairy UN summit catering events through 2031", effects: [{ ticker: 'BUTR', tier: 'major_positive' }] },
  { text: "BUTR Q2 earnings exceed modest expectations — CFO calls result 'a triumph of appropriately low bars'", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }] },
  { text: "ButterCo launches premium line 'Gold Spread' targeting luxury dairy consumers — early sales described as promising", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }] },
  { text: "ButterCo Holdings opens new processing facility in the Western Pasture Region, creating 200 local jobs", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }] },
  { text: "BUTR settles long-running spreadability technology patent dispute on favorable undisclosed terms", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }] },
  { text: "ButterCo Holdings named preferred supplier for three major national grocery chains effective next quarter", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }] },
  { text: "BUTR executive team replaced in full leadership restructure — new team described as 'people who actually show up'", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }] },
  { text: "ButterCo Holdings reports strong holiday season numbers, credits what the CFO called 'the people who still cook' demographic", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }] },
  { text: "ButterCo Holdings misses Q3 projections after executive team reportedly forgot to submit the earnings report on time", effects: [{ ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "BUTR facing backlash over new product ButterLight which critics claim contains 'no discernible butter whatsoever'", effects: [{ ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "ButterCo Holdings loses key distribution partner after repeated delivery delays attributed in official filing to 'the roads'", effects: [{ ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "BUTR Southern Region plant shuts down temporarily following health inspection findings described officially as 'greasy'", effects: [{ ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "ButterCo Holdings CFO discovered expensing personal butter purchases to corporate account for at least three years", effects: [{ ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "BUTR loses market share to margarine alternatives for the second consecutive quarter — executives blame 'cultural shifts'", effects: [{ ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "ButterCo Holdings annual conference cancelled after venue terminates contract citing 'prior negative experience with this client'", effects: [{ ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "ButterCo Holdings CEO arrested after investigation reveals he operated a ghost subsidiary producing no butter, employing nobody, receiving 40% of company revenue", effects: [{ ticker: 'BUTR', tier: 'major_negative' }] },
  { text: "BUTR product recalled across 14 regions after laboratory analysis identifies 'unidentified yellow substance that is definitively not butter'", effects: [{ ticker: 'BUTR', tier: 'major_negative' }] },
  { text: "ButterCo Holdings board votes to dissolve company, immediately reverses, then reverses again — Dairy Financial Authority halts all trading", effects: [{ ticker: 'BUTR', tier: 'major_negative' }] },

  // ── CREM ──────────────────────────────────────────────────────────────────
  { text: "Creme Capital posts record-breaking annual returns — board describes the financial year as 'smooth, rich, and completely without lumps'", effects: [{ ticker: 'CREM', tier: 'major_positive' }] },
  { text: "CREM acquires three boutique dairy investment funds in landmark deal — analysts call it 'the richest single move in market history'", effects: [{ ticker: 'CREM', tier: 'major_positive' }] },
  { text: "Creme Capital named top dairy investment vehicle by Moo News Financial Review for the third consecutive year", effects: [{ ticker: 'CREM', tier: 'major_positive' }] },
  { text: "CREM dividend increased for eighth consecutive quarter — shareholders describe the feeling as 'thick with satisfaction'", effects: [{ ticker: 'CREM', tier: 'minor_positive' }] },
  { text: "Creme Capital expands into Eastern Pasture Region markets, opening four new regional offices simultaneously", effects: [{ ticker: 'CREM', tier: 'minor_positive' }] },
  { text: "CREM partners with Whey Street Group on joint fund targeting medium-volatility dairy assets — early interest strong", effects: [{ ticker: 'CREM', tier: 'minor_positive' }] },
  { text: "Creme Capital Q1 results described as 'soft but genuinely promising' by notoriously hard-to-please analyst Reginald Blot III", effects: [{ ticker: 'CREM', tier: 'minor_positive' }] },
  { text: "CREM brand recognition hits all-time high following successful national 'Stay Creamy' advertising campaign", effects: [{ ticker: 'CREM', tier: 'minor_positive' }] },
  { text: "Creme Capital announces share buyback program worth 800 million milk bucks, effective immediately", effects: [{ ticker: 'CREM', tier: 'minor_positive' }] },
  { text: "CREM CFO Diane Clottsworth promoted to co-CEO — market responds positively to rare display of leadership stability", effects: [{ ticker: 'CREM', tier: 'minor_positive' }] },
  { text: "Creme Capital Q2 earnings fall short of projections — analysts blame 'unusual choppiness in the cream layer'", effects: [{ ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "CREM faces regulatory review over questionable cream-to-capital ratio disclosures in the last three annual reports", effects: [{ ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "Three senior Creme Capital fund managers resign in the same week — company insists it is a coincidence, nobody believes them", effects: [{ ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "CREM loses premium client portfolio to rival MILK after extended contract renegotiation fails to reach agreement", effects: [{ ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "Creme Capital offices visited by Dairy Financial Authority inspectors over alleged smoothness misrepresentation claims", effects: [{ ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "CREM flagship fund posts first quarterly loss in six years — CFO describes it as 'a blip' while visibly sweating", effects: [{ ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "Creme Capital accused of systematically poaching analysts from smaller firms — civil lawsuit filed in Dairy District court", effects: [{ ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "CREM founder Reginald Clott implicated in massive Ponzi scheme disguised as a tiered cream investment product spanning a decade", effects: [{ ticker: 'CREM', tier: 'major_negative' }] },
  { text: "Creme Capital's entire derivatives portfolio found to be backed by expired dairy futures — auditors describe findings as 'disturbing'", effects: [{ ticker: 'CREM', tier: 'major_negative' }] },
  { text: "Creme Capital headquarters evacuated after structural inspection reveals building has technically not been up to code since 1994", effects: [{ ticker: 'CREM', tier: 'major_negative' }] },

  // ── WHEY ──────────────────────────────────────────────────────────────────
  { text: "Whey Street Group closes $4 billion deal with international protein consortium — analysts struggle to process the full implications", effects: [{ ticker: 'WHEY', tier: 'major_positive' }] },
  { text: "WHEY posts record annual earnings on back of global protein demand surge — CFO describes it as 'an absolute gains season for everyone'", effects: [{ ticker: 'WHEY', tier: 'major_positive' }] },
  { text: "Whey Street Group announces partnership with all seven Dairy UN member states in historic multilateral protein supply accord", effects: [{ ticker: 'WHEY', tier: 'major_positive' }] },
  { text: "WHEY Q2 results beat estimates — CFO credits 'the relentless and apparently bottomless human desire for protein'", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }] },
  { text: "Whey Street Group opens new dedicated research facility focused entirely on protein extraction optimization technology", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }] },
  { text: "WHEY expands simultaneously into three new international markets, describes the move as 'aggressive but mathematically necessary'", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }] },
  { text: "Whey Street Group secures exclusive contract with the Moo Olympics Committee for official protein supplement supply through 2028", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }] },
  { text: "WHEY analyst day presentation described as 'genuinely impressive' by a publication that has never used those words before", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }] },
  { text: "Whey Street Group acquires struggling competitor PROTX Holdings for below-market rate — immediately reports it as profitable", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }] },
  { text: "WHEY dividend reinstated after two-year suspension — shareholders exhale collectively on recorded investor call", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }] },
  { text: "Whey Street Group CFO detained at international airport with 40,000 shares printed across the lining of his socks — company calls it 'a personal matter'", effects: [{ ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "WHEY misses Q1 earnings — CFO blames 'an unexpected global decrease in people wanting protein', analysts visibly skeptical", effects: [{ ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Whey Street Group loses key supply chain partner amid escalating dispute over protein purity certification standards", effects: [{ ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "WHEY faces class action from consumers claiming product caused 'excessive and entirely unwanted gains' — lawyers describe case as unprecedented", effects: [{ ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Whey Street Group offices searched by Dairy Financial Authority in connection with broader protein market manipulation probe", effects: [{ ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "WHEY loses three senior traders in one week to competitor CHUG — company calls the departures 'flattering but extremely inconvenient'", effects: [{ ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Whey Street Group quarterly report delayed for the fourth consecutive time — no explanation provided to investors or press", effects: [{ ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Whey Street Group president indicted on 14 counts of protein market manipulation spanning six years and two continents", effects: [{ ticker: 'WHEY', tier: 'major_negative' }] },
  { text: "WHEY found to have been selling diluted whey protein mixed with 'an undisclosed grain product' for 18 months — full regulatory action underway", effects: [{ ticker: 'WHEY', tier: 'major_negative' }] },
  { text: "Whey Street Group loses landmark lawsuit, ordered to pay 1.8 billion milk bucks in damages to former distribution network partners", effects: [{ ticker: 'WHEY', tier: 'major_negative' }] },

  // ── MOO ───────────────────────────────────────────────────────────────────
  { text: "Moo Markets Inc reports record retail investor participation — CEO describes customer base as 'regular people who just want a piece of the dairy dream'", effects: [{ ticker: 'MOO', tier: 'major_positive' }] },
  { text: "MOO stock surges after company reports highest single-day trading volume in its history — analysts attribute it to 'the vibes being correct'", effects: [{ ticker: 'MOO', tier: 'major_positive' }] },
  { text: "Moo Markets Inc secures Dairy UN endorsement as official market index for all 47 member states, effective immediately", effects: [{ ticker: 'MOO', tier: 'major_positive' }] },
  { text: "MOO Q3 earnings solid across the board — CFO noted they 'did exactly what they said they would, which frankly surprised everyone'", effects: [{ ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "Moo Markets Inc launches community investment platform targeting first-time dairy market participants with no minimum buy-in", effects: [{ ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "MOO expands index to include 12 new dairy-adjacent asset classes — early investor interest described as 'healthily enthusiastic'", effects: [{ ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "Moo Markets Inc partners with three regional banks to offer first-ever dairy-backed personal savings account products", effects: [{ ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "MOO brand satisfaction survey returns highest scores in five years — customers describe the experience as 'fine, honestly'", effects: [{ ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "Moo Markets Inc hires 40 new analysts fresh from top dairy finance programs — largest single hiring class in company history", effects: [{ ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "MOO announces quarterly dividend increase of 8% — CEO describes it as 'a thank you to everyone who believed in regular milk'", effects: [{ ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "Moo Markets Inc Q2 results disappointing — CEO admits they 'may have significantly over-mooed on the expansion projections'", effects: [{ ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "MOO faces scrutiny after index calculation error discovered — company says it technically didn't affect anything but acknowledges it looks bad", effects: [{ ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Moo Markets Inc loses three major institutional investors to WHEY — describes each departure as 'genuinely their loss'", effects: [{ ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "MOO platform suffers 6-hour outage during peak trading hours — company blames 'a server that got too warm and needed a moment'", effects: [{ ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Moo Markets Inc cited by Dairy Financial Authority for 'inadequate disclosure practices' buried in annual report footnote on page 94", effects: [{ ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "MOO misses modest Q1 earnings target by the thinnest of margins — analysts say nothing, stare at their spreadsheets", effects: [{ ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Moo Markets Inc fails to make third consecutive payment on naming rights to Moo Markets Arena — stadium quietly removes all signage", effects: [{ ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Moo Markets Inc CEO and CFO both resign the same morning without warning — company releases statement consisting entirely of the word 'fine'", effects: [{ ticker: 'MOO', tier: 'major_negative' }] },
  { text: "MOO revealed to have operated without a valid Dairy Financial Authority license for 11 consecutive months — full investigation launched", effects: [{ ticker: 'MOO', tier: 'major_negative' }] },
  { text: "Moo Markets Inc entire senior leadership team confirmed to be the same person operating under different names since the company's founding", effects: [{ ticker: 'MOO', tier: 'major_negative' }] },

  // ── CHUG ──────────────────────────────────────────────────────────────────
  { text: "Chug Enterprises announces distribution partnership with underground energy collective — new network described as 'everywhere, somehow'", effects: [{ ticker: 'CHUG', tier: 'major_positive' }] },
  { text: "CHUG posts explosive quarterly earnings after viral challenge drives 900% spike in product demand in a single overnight period", effects: [{ ticker: 'CHUG', tier: 'major_positive' }] },
  { text: "Chug Enterprises secures exclusive energy beverage rights to three major stadiums across the Pasture Region through 2030", effects: [{ ticker: 'CHUG', tier: 'major_positive' }] },
  { text: "CHUG Q2 results beat expectations significantly — CFO arrives at press conference visibly energized and does not sit down once", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }] },
  { text: "Chug Enterprises launches extreme new variant CHUG BLACK — early consumer response described by testers as 'alarming in the best way'", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }] },
  { text: "CHUG expands distribution to 8 new regions — logistics partners describe the working relationship as 'intense but consistently profitable'", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }] },
  { text: "Chug Enterprises signs Lil Chug as official brand ambassador in a deal reportedly worth 'an absurd quantity of milk bucks'", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }] },
  { text: "CHUG named official energy drink of the Eastern Pasture Extreme Sports Federation following a three-year negotiation", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }] },
  { text: "Chug Enterprises Q3 pipeline described by attending analysts as 'loaded' — several of them seemed genuinely nervous saying it", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }] },
  { text: "CHUG stock recovers from previous month's dip following official confirmation that 'the ocean ingredient situation has been fully resolved'", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }] },
  { text: "Chug Enterprises board member arrested — company releases statement simultaneously distancing and not distancing itself", effects: [{ ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "CHUG pulled from shelves in two regions following tingling sensation consumer reports — company insists the tingling is 'core to the experience'", effects: [{ ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Chug Enterprises loses key distributor who cites in formal resignation letter 'concerns about the nature of certain ingredients'", effects: [{ ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "CHUG Q1 earnings miss forecast — CFO blames 'a temporary and frankly puzzling decrease in people who want to chug things'", effects: [{ ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Chug Enterprises sued by former employee claiming the workplace ran entirely on CHUG product, creating a legally unsafe environment", effects: [{ ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "CHUG loses Extreme Energy Zone trademark dispute after competitor successfully files blocking trademark at the Dairy Patent Office", effects: [{ ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Chug Enterprises annual report filed three weeks late — contains two sections auditors have formally described as 'creative nonfiction'", effects: [{ ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Chug Enterprises CEO arrested following Dairy Bureau investigation into alleged ties to the Fermented Milk Underground — trading halted", effects: [{ ticker: 'CHUG', tier: 'major_negative' }] },
  { text: "CHUG product found to contain undisclosed stimulant compound currently banned in 9 countries — full worldwide product recall initiated", effects: [{ ticker: 'CHUG', tier: 'major_negative' }] },
  { text: "Explosive documentary 'What Is In CHUG' drops overnight — three former employees speak on record, stock collapses before market open", effects: [{ ticker: 'CHUG', tier: 'major_negative' }] },

  // ── GOT ───────────────────────────────────────────────────────────────────
  { text: "Got Milk Global closes simultaneous expansion into 22 countries — CEO addresses press saying only 'we're everywhere now, deal with it'", effects: [{ ticker: 'GOT', tier: 'major_positive' }] },
  { text: "GOT posts highest single-quarter revenue in company history following a global viral campaign reaching an estimated 4 billion impressions", effects: [{ ticker: 'GOT', tier: 'major_positive' }] },
  { text: "Got Milk Global acquires iconic century-old dairy brand Fromme and Sons in a landmark deal valued at 3.2 billion milk bucks", effects: [{ ticker: 'GOT', tier: 'major_positive' }] },
  { text: "GOT Q2 earnings strong across all international segments — CFO describes global strategy as 'aggressively and correctly paying off'", effects: [{ ticker: 'GOT', tier: 'minor_positive' }] },
  { text: "Got Milk Global opens flagship brand experience center in the Dairy District — first-week attendance shatters all projections", effects: [{ ticker: 'GOT', tier: 'minor_positive' }] },
  { text: "GOT expands product line to include 14 new regional flavor variants — all performing above initial sales forecasts", effects: [{ ticker: 'GOT', tier: 'minor_positive' }] },
  { text: "Got Milk Global signs Lil Chug for limited-edition collaboration product GOT CHUG — pre-order demand crashes the company website", effects: [{ ticker: 'GOT', tier: 'minor_positive' }] },
  { text: "GOT named fastest-growing dairy brand globally for the second consecutive year by Moo News Financial Review", effects: [{ ticker: 'GOT', tier: 'minor_positive' }] },
  { text: "Got Milk Global secures front-of-store placement deals with the five largest grocery chains on three continents", effects: [{ ticker: 'GOT', tier: 'minor_positive' }] },
  { text: "GOT investor day receives standing ovation — confirmed by three sources as the first time this has ever happened at a dairy earnings event", effects: [{ ticker: 'GOT', tier: 'minor_positive' }] },
  { text: "Got Milk Global expansion into Goat Sector markets hits significant unexpected resistance — local sentiment described by field team as 'hostile'", effects: [{ ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "GOT loses major celebrity partnership after brand ambassador makes controversial comments about milk during an unrelated livestream", effects: [{ ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Got Milk Global Q1 earnings miss despite strong revenue — profit margins squeezed by cost of aggressive international expansion", effects: [{ ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "GOT faces consumer backlash in three markets over new packaging design described by focus groups as 'confusing and vaguely threatening'", effects: [{ ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Got Milk Global loses major Northern Region distribution deal following repeated and documented quality control complaints", effects: [{ ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "GOT board member sells 2 million personal shares in a single trading session — company states this is 'unrelated to anything currently happening'", effects: [{ ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Got Milk Global Q3 report delayed after 'discrepancies identified during what was supposed to be a routine internal review'", effects: [{ ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Got Milk Global international expansion revealed to be elaborate facade — investigators confirm half of listed markets do not appear on any known map", effects: [{ ticker: 'GOT', tier: 'major_negative' }] },
  { text: "GOT CEO vanishes the morning of the earnings call — CFO reads prepared statement describing departure as 'a planned sabbatical that was always happening'", effects: [{ ticker: 'GOT', tier: 'major_negative' }] },
  { text: "Got Milk Global hit with simultaneous coordinated regulatory actions in 11 countries — Dairy UN describes investigation as 'unprecedented in the history of dairy'", effects: [{ ticker: 'GOT', tier: 'major_negative' }] },

  // ── SPOIL ─────────────────────────────────────────────────────────────────
  { text: "Spoiled Rotten LLC posts inexplicably massive quarterly profit — auditors confirm the numbers are real and have declined to say anything further", effects: [{ ticker: 'SPOIL', tier: 'major_positive' }] },
  { text: "SPOIL founder Viktor Spoilman returns from 8-month unexplained absence with new business plan described as 'visionary or criminal, the line is genuinely thin'", effects: [{ ticker: 'SPOIL', tier: 'major_positive' }] },
  { text: "Spoiled Rotten LLC signs distribution deal with entity known only as The Consortium — SPOIL stock responds with unusual enthusiasm", effects: [{ ticker: 'SPOIL', tier: 'major_positive' }] },
  { text: "SPOIL Q2 results defy all analyst predictions in the positive direction for once — no official explanation has been offered or sought", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }] },
  { text: "Spoiled Rotten LLC launches new product line with zero public explanation — market decides to interpret this as good news", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }] },
  { text: "SPOIL retains unexpectedly loyal customer base despite everything — brand satisfaction survey results described as 'statistically improbable'", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }] },
  { text: "Spoiled Rotten LLC opens three new facilities in undisclosed locations — investors choose to view the secrecy as a positive indicator", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }] },
  { text: "SPOIL reports strong Q4 revenue, notes in filing that 'the majority of it came from a single Thursday' without further elaboration", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }] },
  { text: "Spoiled Rotten LLC wins lawsuit against former employee who attempted to expose 'the process' — all case details permanently sealed by court order", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }] },
  { text: "SPOIL announces new CEO, described in official press release only as 'someone who understands the product on a deeply spiritual level'", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }] },
  { text: "Spoiled Rotten LLC Q1 results described by the attending auditor as 'technically numbers' — auditor resigned later that same day", effects: [{ ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "SPOIL product linked to 'unusual and difficult-to-describe sensory experiences' across six independent consumer reports — company responds 'that is the intended effect'", effects: [{ ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Spoiled Rotten LLC loses three distribution partners in one week — all citing the exact same undisclosed reason", effects: [{ ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "SPOIL under investigation by the Dairy Bureau of Irregular Products — company releases official response written in a language no one on staff can identify", effects: [{ ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Spoiled Rotten LLC annual report filed on time for the first time in company history — analysts treat this as a cause for suspicion", effects: [{ ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "SPOIL loses flagship wholesale account after client discovers product has no listed expiration date and also no listed country of origin", effects: [{ ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Spoiled Rotten LLC offices visited by city inspector who files report describing premises as 'seemingly empty but somehow still fully operational'", effects: [{ ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Spoiled Rotten LLC founder Viktor Spoilman indicted on 22 counts — the final charge has never been used in a dairy prosecution before", effects: [{ ticker: 'SPOIL', tier: 'major_negative' }] },
  { text: "SPOIL entire product line recalled simultaneously after Dairy Bureau inspection determines the facility 'should not exist under current regulations'", effects: [{ ticker: 'SPOIL', tier: 'major_negative' }] },
  { text: "Spoiled Rotten LLC revealed to have no registered employees, no verifiable physical address, and a CEO whose public records list him as deceased since 2011", effects: [{ ticker: 'SPOIL', tier: 'major_negative' }] },

  // ── RIVALRY / MULTI-STOCK ─────────────────────────────────────────────────
  { text: "MilkCorp Industries poaches Creme Capital's top three analysts in a single afternoon, calls it 'a free market'", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "Creme Capital wins disputed government contract that MilkCorp had held for seven consecutive years", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "MilkCorp retains top spot as most trusted dairy brand globally as Got Milk Global drops out of the top 10 for first time", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Got Milk Global overtakes MilkCorp as the most recognized dairy brand in the under-35 demographic", effects: [{ ticker: 'GOT', tier: 'minor_positive' }, { ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "Whey Street Group wins exclusive rights to Eastern Pasture sports nutrition contract, edging out Chug Enterprises", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }, { ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Chug Enterprises signs three WHEY Street senior traders amid an internal WHEY compensation dispute", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }, { ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "ButterCo Holdings wins spreadable luxury market share from Creme Capital following consumer preference survey results", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }, { ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "Creme Capital expands into spreadable fats sector, directly competing with ButterCo Holdings' core market", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "Moo Markets Inc attracts wave of retail investors abandoning Whey Street Group over transparency concerns", effects: [{ ticker: 'MOO', tier: 'minor_positive' }, { ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Whey Street Group launches competing retail investor platform, directly challenging Moo Markets Inc's core business", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }, { ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Spoiled Rotten LLC quietly acquires three of CHUG's regional distribution contracts through unnamed intermediary", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }, { ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Chug Enterprises wins back key territories lost to Spoiled Rotten LLC following successful legal challenge", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }, { ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Dairy UN imposes new tariffs on non-dairy beverages — both stable dairy producers expected to benefit significantly", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'CREM', tier: 'minor_positive' }] },
  { text: "Joint exposé published simultaneously targeting both CHUG and GOT over allegedly deceptive marketing to youth demographics", effects: [{ ticker: 'CHUG', tier: 'minor_negative' }, { ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "New Dairy Financial Authority regulations require full ingredient transparency from all producers — both stable giants facing steep compliance costs", effects: [{ ticker: 'MILK', tier: 'minor_negative' }, { ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "Dairy Bureau announces broad investigation into protein market pricing practices — both investment firms named in the probe", effects: [{ ticker: 'WHEY', tier: 'minor_negative' }, { ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Eastern Pasture Region lifts energy beverage restrictions, opening a massive new consumer market for both volatile players", effects: [{ ticker: 'GOT', tier: 'minor_positive' }, { ticker: 'CHUG', tier: 'minor_positive' }] },
  { text: "ButterCo Holdings captures major institutional account previously held exclusively by Whey Street Group", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }, { ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Consumer survey finds younger demographic strongly prefers Got Milk Global branding over MilkCorp's 'traditional' image", effects: [{ ticker: 'GOT', tier: 'minor_positive' }, { ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "Spoiled Rotten LLC attracts wave of speculative retail investors departing Moo Markets citing 'not enough chaos'", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }, { ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Moo News reports institutional funds rotating into stable-to-medium positions following volatile sector turbulence", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'WHEY', tier: 'minor_positive' }] },
  { text: "High-profile celebrity pivot from energy drinks to 'clean dairy' sends consumers toward Creme Capital's lifestyle products", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Dairy Bureau quality standards crackdown announced — analysts expect MilkCorp to benefit while SPOIL faces renewed scrutiny", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Got Milk Global expansion stumbles badly in three key markets — institutional investors rotate toward safer MILK position", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Consumer trend away from saturated fats hurts ButterCo Holdings while driving demand for premium Creme Capital products", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "International protein demand surge pulls institutional money away from the domestic spreadable fats sector", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "Moo Markets Inc retail platform attracts record signups as GOT brand controversy deters new investors", effects: [{ ticker: 'MOO', tier: 'minor_positive' }, { ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Chug Enterprises grassroots fanbase drives speculative buying surge as Moo Markets reports steady institutional outflows", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }, { ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Dairy Bureau crackdown on irregular product classifications pushes conservative investors into Whey Street Group", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }, { ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Independent taste test places Creme Capital's lifestyle product line above MilkCorp's flagship in four out of five categories", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "Got Milk Global new global campaign goes massively viral while ButterCo Holdings struggles with ongoing product identity crisis", effects: [{ ticker: 'GOT', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "Moo News investigation into premium dairy pricing sends investors to chaos hedge — SPOIL sees unusual inflow", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }, { ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "MilkCorp poaches ButterCo's top three regional distribution managers in what insiders describe as 'a coordinated raid'", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "Got Milk Global's international brand power begins absorbing athlete endorsement deals previously dominated by Whey Street Group", effects: [{ ticker: 'GOT', tier: 'minor_positive' }, { ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Institutional investors migrate from Moo Markets to Creme Capital amid index calculation controversy fallout", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Energy beverage sector captures significant share of consumer spending from traditional dairy in quarterly lifestyle survey", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "Rumors of mysterious SPOIL-affiliated fund buying Creme Capital short positions causes brief but notable market disturbance", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }, { ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "MilkCorp Industries announces expanded product line that directly encroaches on Whey Street's protein supplement territory", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Got Milk Global international controversy drives conservative investors into the familiar comfort of Creme Capital holdings", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "ButterCo Holdings wins regulatory challenge that blocks Spoiled Rotten LLC from entering the spreadable fats category", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }, { ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Moo Markets launches new fraud-detection index that explicitly flags SPOIL-style holdings as high-risk — retail investors respond", effects: [{ ticker: 'MOO', tier: 'minor_positive' }, { ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Major health report linking energy beverages to 'unnecessary vibrating' triggers consumer shift toward traditional dairy", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Protein sector declared hottest investment category of the quarter by Moo News, pulling institutional money from stable funds", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }, { ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "Moo News reports surging global dairy consumption across all demographics — both companies well-positioned to capitalize", effects: [{ ticker: 'GOT', tier: 'minor_positive' }, { ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "Joint Dairy Bureau sting operation announced targeting both irregular product manufacturers — details to follow", effects: [{ ticker: 'SPOIL', tier: 'minor_negative' }, { ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Global protein market report shows consumer shift from liquid dairy to powder supplements accelerating faster than expected", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }, { ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "Moo News annual investor confidence survey ranks both companies in top tier for transparency and reliability", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "Consumer spending on both spreadable fats and protein supplements declines in quarterly household budget survey", effects: [{ ticker: 'BUTR', tier: 'minor_negative' }, { ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Eastern Pasture Region youth demographic report shows record engagement with both volatile dairy-adjacent brands", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }, { ticker: 'GOT', tier: 'minor_positive' }] },
  { text: "Got Milk Global board shakeup triggers institutional uncertainty — speculative money flows toward SPOIL as chaos hedge", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }, { ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Dairy UN formal endorsement of regulated market products benefits both MilkCorp and Moo Markets significantly", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "Moo News lifestyle report declares 'the era of smooth' officially over — consumers shifting hard toward intense, volatile products", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }, { ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "New regional trade agreement opens previously closed pasture markets to both spreadable fats and dairy index products", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }, { ticker: 'MOO', tier: 'minor_positive' }] },
  { text: "International markets report simultaneous cooldown in both expansion-stage dairy and protein investment categories", effects: [{ ticker: 'GOT', tier: 'minor_negative' }, { ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Spoiled Rotten LLC's anonymous acquisition arm quietly purchases ButterCo's three most profitable regional franchises", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "Quarterly consumer energy report shows traditional milk consumption falling among 18-30 demographic as CHUG use rises", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }, { ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "Dairy Financial Authority tightens reporting requirements — Creme Capital praises move while SPOIL declines to acknowledge it", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "International sports event drives simultaneous demand surge for both protein supplements and premium spreadable products", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_positive' }] },
  { text: "Dual earnings misses from both companies in the same reporting week rattles mid-tier dairy investor confidence broadly", effects: [{ ticker: 'MOO', tier: 'minor_negative' }, { ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Energy regulator crackdown on stimulant-adjacent beverages hits CHUG while SPOIL's unclassified product somehow escapes scrutiny", effects: [{ ticker: 'CHUG', tier: 'minor_negative' }, { ticker: 'SPOIL', tier: 'minor_positive' }] },
  { text: "Joint MilkCorp and ButterCo breakfast campaign drives the largest dairy morning consumption increase in five years", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_positive' }] },
  { text: "International athlete partnership deals flow to both Got Milk Global and Whey Street Group following Dairy Olympics coverage spike", effects: [{ ticker: 'GOT', tier: 'minor_positive' }, { ticker: 'WHEY', tier: 'minor_positive' }] },
  { text: "Moo News publishes report questioning valuation methodology of both stable and index-tracking dairy investment vehicles", effects: [{ ticker: 'CREM', tier: 'minor_negative' }, { ticker: 'MOO', tier: 'minor_negative' }] },
  { text: "Traditional dairy products see resurgence in home cooking segment, pulling discretionary spending away from energy beverages", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }, { ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "Dairy Bureau enforcement sweep removes three SPOIL-adjacent products from shelves — compliant producers like MilkCorp benefit", effects: [{ ticker: 'MILK', tier: 'minor_positive' }, { ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Protein market volatility drives institutional rotation back into smooth, reliable Creme Capital holdings", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'WHEY', tier: 'minor_negative' }] },
  { text: "Got Milk Global retreat from Northern Region opens territory that ButterCo Holdings moves into within days", effects: [{ ticker: 'BUTR', tier: 'minor_positive' }, { ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Retail investor confidence report favors stable index products over high-volatility energy plays this quarter", effects: [{ ticker: 'MOO', tier: 'minor_positive' }, { ticker: 'CHUG', tier: 'minor_negative' }] },
  { text: "MilkCorp quality control scandal briefly makes SPOIL's 'we never claimed quality' positioning look comparatively honest", effects: [{ ticker: 'SPOIL', tier: 'minor_positive' }, { ticker: 'MILK', tier: 'minor_negative' }] },
  { text: "Premium positioning pays off for Creme Capital as Got Milk Global's mass-market image suffers in luxury segment research", effects: [{ ticker: 'CREM', tier: 'minor_positive' }, { ticker: 'GOT', tier: 'minor_negative' }] },
  { text: "Consumer preference for internationally recognized brands over regional specialists grows across all pasture region surveys", effects: [{ ticker: 'GOT', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "Protein market legitimization effort backed by Dairy UN creates formal standards that effectively exclude SPOIL from the category", effects: [{ ticker: 'WHEY', tier: 'minor_positive' }, { ticker: 'SPOIL', tier: 'minor_negative' }] },
  { text: "Energy beverage sector report declares highest growth of any dairy-adjacent category — traditional investment vehicles lag", effects: [{ ticker: 'CHUG', tier: 'minor_positive' }, { ticker: 'CREM', tier: 'minor_negative' }] },
  { text: "First-time retail investors strongly prefer market index products over commodity-backed holdings per Moo News quarterly survey", effects: [{ ticker: 'MOO', tier: 'minor_positive' }, { ticker: 'BUTR', tier: 'minor_negative' }] },
  { text: "Got Milk Global's aggressive brand cleanup campaign wins consumer trust that Spoiled Rotten LLC will never have", effects: [{ ticker: 'GOT', tier: 'minor_positive' }, { ticker: 'SPOIL', tier: 'minor_negative' }] },

  // ── SECTOR / MARKET-WIDE ──────────────────────────────────────────────────
  { text: "Dairy UN announces global 'Drink More Milk' initiative backed by 47 member states — entire sector expected to benefit", effects: [{ ticker: 'ALL', tier: 'major_positive' }] },
  { text: "World Health Assembly publishes new report linking excessive dairy consumption to 'a number of things we'd rather not name publicly'", effects: [{ ticker: 'ALL', tier: 'major_negative' }] },
  { text: "Record global dairy demand reported for third consecutive quarter — analysts revise all sector projections upward", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Dairy Financial Authority announces sweeping new compliance regulations affecting all market participants simultaneously", effects: [{ ticker: 'ALL', tier: 'minor_negative' }] },
  { text: "Moo News annual State of the Dairy report declares current climate 'the best time in history to be in dairy'", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Global milk shortage warning issued by the Dairy UN following unexplained decrease in herd production across three continents", effects: [{ ticker: 'ALL', tier: 'major_negative' }] },
  { text: "New international trade agreement eliminates dairy tariffs across 30 countries, effective next quarter", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Dairy Cold War escalates sharply after Goat Sector imposes retaliatory sanctions on all cow-based product exporters", effects: [{ ticker: 'ALL', tier: 'minor_negative' }] },
  { text: "Consumer confidence index hits 10-year high — dairy sector named among top three beneficiaries in Moo News forecast", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Major international dairy fraud ring uncovered — Dairy Bureau confirms investigation touches multiple market sectors simultaneously", effects: [{ ticker: 'ALL', tier: 'minor_negative' }] },
  { text: "Dairy UN emergency summit concludes with joint communiqué describing sector outlook as 'exceptionally creamy'", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Global shipping disruption affects dairy cold chain across all major distribution routes — full impact still being assessed", effects: [{ ticker: 'ALL', tier: 'minor_negative' }] },
  { text: "Independent research confirms dairy products as 'statistically superior to all alternatives' — specific methodology left undisclosed", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Moo News investigative series 'The Milk Files' begins publication today — sources describe forthcoming revelations as 'significant'", effects: [{ ticker: 'ALL', tier: 'minor_negative' }] },
  { text: "Eastern Pasture Region joins Dairy UN, opening the single largest untapped dairy consumer market in recorded history", effects: [{ ticker: 'ALL', tier: 'major_positive' }] },
  { text: "Goat Sector economic crisis triggers global dairy investor uncertainty — analysts recommend caution across all positions", effects: [{ ticker: 'ALL', tier: 'minor_negative' }] },
  { text: "Annual Dairy Olympics breaks all viewership records — sector-wide brand exposure described as 'unprecedented and extremely milky'", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Dairy Financial Authority announces unannounced audit season for all registered dairy market participants — no exceptions", effects: [{ ticker: 'ALL', tier: 'minor_negative' }] },
  { text: "New scientific study confirms daily dairy consumption extends lifespan by a figure Moo News describes as 'honestly impressive'", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Spreadable Fats Conflict officially escalates to armed dairy dispute — trade routes through the Pasture Corridor suspended indefinitely", effects: [{ ticker: 'ALL', tier: 'major_negative' }] },
  { text: "Three consecutive months of strong consumer dairy spending reported — market analysts run out of positive synonyms for 'good'", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Dairy market-wide margin compression warning issued following input cost surge across all categories simultaneously", effects: [{ ticker: 'ALL', tier: 'minor_negative' }] },
  { text: "Moo News poll names dairy investment 'most exciting market category' for second consecutive year — general public confused but supportive", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },
  { text: "Coordinated short-selling operation targeting the entire dairy sector detected — Dairy Financial Authority investigating the source", effects: [{ ticker: 'ALL', tier: 'minor_negative' }] },
  { text: "Dairy UN votes to formally recognize the Moo Markets index as global standard — legitimacy boost felt across all holdings", effects: [{ ticker: 'ALL', tier: 'minor_positive' }] },

  // ── RED HERRINGS ──────────────────────────────────────────────────────────
  { text: "Scientists confirm milk is still white", effects: [] },
  { text: "BUTR Holdings changes the font on its company logo — employees describe the process as 'fine, whatever'", effects: [] },
  { text: "Local man says he drinks CHUG every morning and has never felt anything in particular", effects: [] },
  { text: "Moo News correspondent finishes glass of milk on camera. Puts it down. Nothing happens.", effects: [] },
  { text: "MilkCorp CEO Gerald Holstein seen walking into a building — nature of building unknown, no statement issued", effects: [] },
  { text: "CREM releases new annual report cover design — described by three separate analysts as 'a document'", effects: [] },
  { text: "Spoiled Rotten LLC updates its terms of service for the first time in four years — changes described as 'minor'", effects: [] },
  { text: "Got Milk Global executive team photographed at a restaurant together — company declines to confirm or deny they had dairy", effects: [] },
  { text: "Whey Street Group moves offices to new floor of same building — commute time for employees unchanged", effects: [] },
  { text: "Moo Markets Inc updates mobile app icon — user reviews describe new version as 'still an app'", effects: [] },
  { text: "ButterCo Holdings CEO attends industry conference, sits in third row, leaves after lunch", effects: [] },
  { text: "CHUG Enterprises unveils new can color — focus group describes it as 'a color'", effects: [] },
  { text: "Annual Dairy Industry Luncheon held — all major companies attended, sandwiches were reportedly acceptable", effects: [] },
  { text: "MilkCorp Q4 office holiday party described by attendees as 'a party that happened'", effects: [] },
  { text: "Moo News reports that Tuesday was a relatively quiet day across all dairy markets", effects: [] },
  { text: "SPOIL LLC responds to routine filing request — response described by recipient as 'received'", effects: [] },
  { text: "GOT Milk Global marketing intern wins internal award — company releases press announcement, most ignore it", effects: [] },
  { text: "BUTR Holdings reports all systems operational — nothing is currently on fire", effects: [] },
  { text: "Dairy UN holds regularly scheduled Tuesday meeting — minutes described as 'uneventful'", effects: [] },
  { text: "Whey Street Group printer on 3rd floor repaired — productivity among affected employees restored", effects: [] },
  { text: "Creme Capital renews office cleaning contract for additional three years — terms undisclosed, nor relevant", effects: [] },
  { text: "Local barista reports slight increase in customers requesting milk — cannot confirm any connection to broader market", effects: [] },
  { text: "MilkCorp Industries issues updated employee handbook — new section added on 'appropriate milk-related workplace conduct'", effects: [] },
  { text: "CHUG Enterprises confirms its headquarters has doors and a parking lot — photos available on request", effects: [] },
  { text: "Moo News asks 100 people if they've heard of Got Milk Global — 94 say yes, 6 say 'sort of'", effects: [] },
  { text: "MOO Markets IT department confirms servers are 'doing their thing' following routine maintenance window", effects: [] },
  { text: "BUTR Holdings CEO seen pumping gas — vehicle make unknown, tank status unclear, market unaffected", effects: [] },
  { text: "Dairy Financial Authority confirms it continues to exist and is open for business on weekdays", effects: [] },
  { text: "CREM Capital employee celebrates 10-year work anniversary — colleagues describe the cake as 'pretty good'", effects: [] },
  { text: "Spoiled Rotten LLC files routine quarterly form three days early — first time this has occurred, analysts unsure what to make of it", effects: [] },
  { text: "MILK stock analyst seen eating lunch at desk — sources confirm it was not milk-related, nothing further confirmed", effects: [] },
  { text: "GOT Milk Global updates website footer copyright to current year — rollout described as going smoothly", effects: [] },
  { text: "Moo News fact-checks claim that CHUG is 'the loudest beverage' — results described as 'inconclusive'", effects: [] },
  { text: "Whey Street Group executive team confirmed to all be alive and present at this morning's stand-up meeting", effects: [] },
  { text: "ButterCo Holdings submits all required government forms on time — compliance team describes it as 'our job'", effects: [] },
  { text: "Moo News reporter asks MOO CFO how he's doing — CFO says 'fine, thanks for asking' — no further developments", effects: [] },
  { text: "Annual Moo News reader poll asks favorite dairy stock — results described as 'a distribution of opinions'", effects: [] },
  { text: "SPOIL LLC registers new trademark for a phrase consisting entirely of punctuation marks — no comment issued", effects: [] },
  { text: "MilkCorp water cooler replaced in main lobby — new unit described by receptionist as 'cold, which is correct'", effects: [] },
  { text: "Dairy market closes on Friday, will reopen Monday — this is expected and has happened before", effects: [] },
];

// ─── MODIFIERS ────────────────────────────────────────────────────────────────

function applyEffects(effects) {
  for (const { ticker, tier } of effects) {
    const value = rollTier(tier);
    pendingModifiers[ticker] = Math.max(-0.50, Math.min(0.50,
      (pendingModifiers[ticker] || 0) + value
    ));
  }
}

// ─── SCHEDULER ────────────────────────────────────────────────────────────────

async function dropNews(client, headline) {
  applyEffects(headline.effects);

  const guild = client.guilds.cache.get(GUILD_ID);
  const channel = guild?.channels.cache.find(c => c.name === 'milkbot-stocks');
  if (!channel) return;

  await channel.send(
    `📰 **MOO NEWS** 📰\n\n` +
    `*${headline.text}*\n\n` +
    `*— Moo News, your trusted source for dairy market intelligence* 🥛`
  ).catch(console.error);

  state.lastNewsAt = Date.now();
}

function scheduleNews(client) {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const msRemaining = midnight - now;

  const count = Math.floor(Math.random() * 4) + 6; // 6–9 drops
  for (let i = 0; i < count; i++) {
    const delay = Math.floor(Math.random() * msRemaining);
    const headline = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];

    // 30% chance to DM a random player an insider tip ~3 minutes before the news
    if (Math.random() < 0.30) {
      const tipDelay = Math.max(0, delay - 3 * 60 * 1000);
      setTimeout(() => sendInsiderTip(client, headline), tipDelay);
    }

    setTimeout(() => dropNews(client, headline), delay);
  }

  setTimeout(() => scheduleNews(client), msRemaining);
}

module.exports = { scheduleNews, pendingModifiers };
