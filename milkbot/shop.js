const fs = require('fs');
const path = require('path');

const buffsPath     = path.join(__dirname, 'data/buffs.json');
const inventoryPath = path.join(__dirname, 'data/inventory.json');
const shopstatePath = path.join(__dirname, 'data/shopstate.json');
const balancesPath  = path.join(__dirname, 'data/balances.json');

// ── Item Definitions ──────────────────────────────────────────────────────────
// effect.type values:
//   earnings_mul, xp_mul, jackpot_mul, raid_damage, raid_damage_timed,
//   raid_damage_mul, raid_shield, daily_mul, streak_shield,
//   next_win_mul, instant_cash, boss_nuke, cursed_orb, combo_surge, combo_raid
//
// duration: ms for timed buffs, null for use-count or instant
// uses: N for use-count buffs, null for timed/instant
// boss_nuke and cursed_orb go to inventory; instant_cash applied immediately;
// everything else activates immediately (stored in buffs.json).

const ITEMS = {
  // ── COMMON (100–750 mb) ─────────────────────────────────────────────────────
  splash_cream:    { name: "Splash of Cream",      tier: 'COMMON',    price: 100,    emoji: '🥛',  description: '+10% earnings for 15 min',                   flavorText: "a little goes a long way. unless it's milk. then pour more.",                          effect: { type: 'earnings_mul',    value: 0.10 }, duration: 15 * 60 * 1000,          uses: null },
  milkman_penny:   { name: "Milkman's Penny",       tier: 'COMMON',    price: 100,    emoji: '🪙',  description: '+10 flat raid damage, next attack',           flavorText: "found on the floor of a dairy. still valid.",                                          effect: { type: 'raid_damage',     value: 10   }, duration: null,                     uses: 1    },
  baby_bottle:     { name: "Baby Bottle",            tier: 'COMMON',    price: 150,    emoji: '🍼',  description: '+150 mb instant',                             flavorText: "you crawled so you could walk. and now you're crawling again. pathetic.",               effect: { type: 'instant_cash',    value: 150  }, duration: null,                     uses: null },
  udderly_basic:   { name: "Udderly Basic",          tier: 'COMMON',    price: 200,    emoji: '🐄',  description: '+8% XP for 30 min',                          flavorText: "not impressive. but it's honest work.",                                               effect: { type: 'xp_mul',         value: 0.08 }, duration: 30 * 60 * 1000,          uses: null },
  dairy_pebble:    { name: "Dairy Pebble",           tier: 'COMMON',    price: 250,    emoji: '🪨',  description: '+15% XP for 1 hr',                           flavorText: "it's a rock. a dairy rock. don't question it.",                                        effect: { type: 'xp_mul',         value: 0.15 }, duration: 60 * 60 * 1000,          uses: null },
  cream_starter:   { name: "Cream Starter",          tier: 'COMMON',    price: 250,    emoji: '✨',  description: '+15% jackpot chance for 30 min',             flavorText: "the jackpot doesn't know you're coming. you do.",                                     effect: { type: 'jackpot_mul',    value: 0.15 }, duration: 30 * 60 * 1000,          uses: null },
  skim_stone:      { name: "Skim Stone",             tier: 'COMMON',    price: 350,    emoji: '🌊',  description: '+10% all earnings for 30 min',               flavorText: "skim it off the top. that's basically investing.",                                     effect: { type: 'earnings_mul',   value: 0.10 }, duration: 30 * 60 * 1000,          uses: null },
  warm_milk_mug:   { name: "Warm Milk Mug",          tier: 'COMMON',    price: 400,    emoji: '☕',  description: '+350 mb instant',                             flavorText: "hot. comforting. full of milk bucks somehow.",                                         effect: { type: 'instant_cash',   value: 350  }, duration: null,                     uses: null },
  butter_chip:     { name: "Butter Chip",            tier: 'COMMON',    price: 400,    emoji: '🧈',  description: '+20% jackpot chance for 1 hr',               flavorText: "greased up and ready to win. don't think about it too hard.",                         effect: { type: 'jackpot_mul',    value: 0.20 }, duration: 60 * 60 * 1000,          uses: null },
  baby_hoof:       { name: "Baby Hoof",              tier: 'COMMON',    price: 200,    emoji: '🐾',  description: '+30 flat raid damage, next attack',           flavorText: "small. but it absolutely connects.",                                                  effect: { type: 'raid_damage',    value: 30   }, duration: null,                     uses: 1    },
  curd_cracker:    { name: "Curd Cracker",           tier: 'COMMON',    price: 500,    emoji: '🛡️', description: 'Negate next raid counter-attack',             flavorText: "you hit it. it tries to hit back. nope.",                                             effect: { type: 'raid_shield',    value: 1    }, duration: null,                     uses: 1    },
  milk_thistle:    { name: "Milk Thistle",           tier: 'COMMON',    price: 600,    emoji: '🌿',  description: '+20% XP for 2 hr',                           flavorText: "technically it's a plant. technically it works.",                                     effect: { type: 'xp_mul',         value: 0.20 }, duration: 2 * 60 * 60 * 1000,     uses: null },
  fresh_cream_drop:{ name: "Fresh Cream Drop",       tier: 'COMMON',    price: 550,    emoji: '💧',  description: '+15% daily reward, next claim',              flavorText: "tomorrow's milk, today. kind of.",                                                    effect: { type: 'daily_mul',      value: 0.15 }, duration: null,                     uses: 1    },
  beginners_jug:   { name: "Beginner's Jug",         tier: 'COMMON',    price: 750,    emoji: '🫙',  description: '+15% all earnings for 1 hr',                 flavorText: "it's the starter jug. everyone starts here. most stay here.",                         effect: { type: 'earnings_mul',   value: 0.15 }, duration: 60 * 60 * 1000,          uses: null },

  // ── UNCOMMON (1,000–4,500 mb) ───────────────────────────────────────────────
  lucky_hoof:      { name: "Lucky Hoof Charm",       tier: 'UNCOMMON',  price: 1500,   emoji: '🍀',  description: '+100% jackpot chance for 3 hr',              flavorText: "double your odds. still probably won't hit. but double.",                            effect: { type: 'jackpot_mul',    value: 1.00 }, duration: 3 * 60 * 60 * 1000,     uses: null },
  cream_booster:   { name: "Cream Booster Vial",     tier: 'UNCOMMON',  price: 2000,   emoji: '⚗️', description: '+30% all earnings for 2 hr',                 flavorText: "you want +30% earnings? pour it in. don't ask questions.",                           effect: { type: 'earnings_mul',   value: 0.30 }, duration: 2 * 60 * 60 * 1000,     uses: null },
  butter_blade:    { name: "Butter Blade",           tier: 'UNCOMMON',  price: 1200,   emoji: '🗡️', description: '+100 flat raid damage, next attack',          flavorText: "forged in butter. sharpened with spite.",                                             effect: { type: 'raid_damage',    value: 100  }, duration: null,                     uses: 1    },
  milk_shield:     { name: "Milk Shield",            tier: 'UNCOMMON',  price: 1800,   emoji: '🛡️', description: 'Negate next 3 raid counter-attacks',          flavorText: "three hits. blocked. three times. like a wall of dairy.",                            effect: { type: 'raid_shield',    value: 1    }, duration: null,                     uses: 3    },
  double_cream:    { name: "Double Cream Vial",      tier: 'UNCOMMON',  price: 2500,   emoji: '💥',  description: '2x earnings, next single win only',           flavorText: "one shot. double the payout. make it count.",                                         effect: { type: 'next_win_mul',   value: 1.00 }, duration: null,                     uses: 1    },
  whey_flask:      { name: "Whey Protein Flask",     tier: 'UNCOMMON',  price: 2000,   emoji: '💪',  description: '+60% XP for 4 hr',                           flavorText: "bulk season. the XP gainz are real.",                                                 effect: { type: 'xp_mul',         value: 0.60 }, duration: 4 * 60 * 60 * 1000,     uses: null },
  iron_udder:      { name: "Iron Udder Armor",       tier: 'UNCOMMON',  price: 3000,   emoji: '⚙️', description: 'Negate all raid counters for 3 hr',           flavorText: "ironclad. no counter-attack can touch you for 3 hours.",                             effect: { type: 'raid_shield',    value: 1    }, duration: 3 * 60 * 60 * 1000,     uses: null },
  dairy_catalyst:  { name: "Dairy Catalyst",         tier: 'UNCOMMON',  price: 2500,   emoji: '🧪',  description: '+45% all earnings for 90 min',               flavorText: "catalyze the dairy. turn your milk bucks into more milk bucks.",                     effect: { type: 'earnings_mul',   value: 0.45 }, duration: 90 * 60 * 1000,          uses: null },
  butter_amulet:   { name: "Butter Amulet",          tier: 'UNCOMMON',  price: 3500,   emoji: '📿',  description: '+30% all earnings for 3 hr',                 flavorText: "ancient dairy magic. buttery. powerful. smells fine.",                               effect: { type: 'earnings_mul',   value: 0.30 }, duration: 3 * 60 * 60 * 1000,     uses: null },
  mozz_luck:       { name: "Mozzarella Luck Stone",  tier: 'UNCOMMON',  price: 3000,   emoji: '🎲',  description: '+50% jackpot chance for 6 hr',               flavorText: "pull it. stretch it. pray to it. it listens sometimes.",                             effect: { type: 'jackpot_mul',    value: 0.50 }, duration: 6 * 60 * 60 * 1000,     uses: null },
  raid_horn:       { name: "Raid Horn",              tier: 'UNCOMMON',  price: 2200,   emoji: '📯',  description: '+75 flat raid damage for 3 hr',              flavorText: "blow the horn. deal the damage. it's that simple.",                                   effect: { type: 'raid_damage_timed', value: 75}, duration: 3 * 60 * 60 * 1000,    uses: null },
  cream_surge:     { name: "Cream Surge",            tier: 'UNCOMMON',  price: 4000,   emoji: '⚡',  description: '+50% XP AND +50% earnings for 1 hr',         flavorText: "surge of dairy energy. everything goes up. briefly.",                                  effect: { type: 'combo_surge',    value: 0.50 }, duration: 60 * 60 * 1000,          uses: null },
  curds_fortune:   { name: "Curds of Fortune",       tier: 'UNCOMMON',  price: 2800,   emoji: '🍀',  description: '+25% all earnings for 4 hr',                 flavorText: "curds are underrated. this item is not.",                                             effect: { type: 'earnings_mul',   value: 0.25 }, duration: 4 * 60 * 60 * 1000,     uses: null },
  gouda_lance:     { name: "Gouda Lance",            tier: 'UNCOMMON',  price: 1800,   emoji: '⚔️', description: '+150 flat raid damage, next attack',          flavorText: "gouda. the hardest cheese. the sharpest lance.",                                      effect: { type: 'raid_damage',    value: 150  }, duration: null,                     uses: 1    },
  brie_shield:     { name: "Brie Shield",            tier: 'UNCOMMON',  price: 4500,   emoji: '🧀',  description: 'Negate all raid counters for 1 hr',           flavorText: "brie. soft on the outside. impenetrable on the inside.",                             effect: { type: 'raid_shield',    value: 1    }, duration: 60 * 60 * 1000,          uses: null },
  streak_saver:    { name: "Streak Saver Sash",      tier: 'UNCOMMON',  price: 3500,   emoji: '🎀',  description: 'Protect hot streak from 1 loss',             flavorText: "you lost. your streak didn't. this time.",                                            effect: { type: 'streak_shield',  value: 1    }, duration: null,                     uses: 1    },
  whey_warhorn:    { name: "Whey Warhorn",           tier: 'UNCOMMON',  price: 2800,   emoji: '🐂',  description: '+125 flat raid damage, next attack',          flavorText: "the war horn of the dairy. enemies tremble.",                                         effect: { type: 'raid_damage',    value: 125  }, duration: null,                     uses: 1    },
  soft_amulet:     { name: "Soft Cheese Amulet",     tier: 'UNCOMMON',  price: 1800,   emoji: '🧿',  description: '+40% XP for 3 hr',                           flavorText: "soft. but the XP gains are not.",                                                    effect: { type: 'xp_mul',         value: 0.40 }, duration: 3 * 60 * 60 * 1000,     uses: null },
  creamery_coin:   { name: "Creamery Coin",          tier: 'UNCOMMON',  price: 2500,   emoji: '🪙',  description: '+75% daily reward, next 2 claims',           flavorText: "minted in the creamery. spend it on more milk bucks.",                               effect: { type: 'daily_mul',      value: 0.75 }, duration: null,                     uses: 2    },
  butter_gauntlet: { name: "Butter Gauntlet",        tier: 'UNCOMMON',  price: 3200,   emoji: '🥊',  description: '+80 flat raid damage, next 3 attacks',        flavorText: "butter-coated fists. three hits. all of them hurt.",                                  effect: { type: 'raid_damage',    value: 80   }, duration: null,                     uses: 3    },

  // ── RARE (4,500–15,000 mb) ──────────────────────────────────────────────────
  golden_udder:    { name: "Golden Udder",           tier: 'RARE',      price: 5000,   emoji: '🏆',  description: '+75% all earnings for 6 hr',                 flavorText: "the golden udder. they said it was a myth. it's not.",                                effect: { type: 'earnings_mul',   value: 0.75 }, duration: 6 * 60 * 60 * 1000,     uses: null },
  curdbreaker_axe: { name: "Curdbreaker Axe",        tier: 'RARE',      price: 4500,   emoji: '🪓',  description: '3x raid damage, next 2 attacks',              flavorText: "it breaks curds. it breaks enemies. mostly enemies.",                                 effect: { type: 'raid_damage_mul', value: 2.0 }, duration: null,                    uses: 2    },
  berserker_brew:  { name: "Moo Berserker Brew",     tier: 'RARE',      price: 7500,   emoji: '🧃',  description: '5x next single raid attack (counter risk stays)', flavorText: "drink it. lose control. deal 5x damage. hope for the best.",                  effect: { type: 'raid_damage_mul', value: 4.0 }, duration: null,                    uses: 1    },
  liquid_gold:     { name: "Liquid Gold Milk",       tier: 'RARE',      price: 9000,   emoji: '✨',  description: '+100% all earnings for 8 hr',                flavorText: "liquid gold. literally. you're rich. for 8 hours.",                                   effect: { type: 'earnings_mul',   value: 1.00 }, duration: 8 * 60 * 60 * 1000,     uses: null },
  diamond_straw:   { name: "Diamond Straw",          tier: 'RARE',      price: 6000,   emoji: '💎',  description: '+150% earnings for next 10 wins',             flavorText: "sip through the diamond straw. taste the wealth.",                                    effect: { type: 'next_win_mul',   value: 1.50 }, duration: null,                     uses: 10   },
  blessed_armor:   { name: "Blessed Udder Armor",    tier: 'RARE',      price: 6500,   emoji: '✝️', description: 'Immune to all raid counters for 24 hr',       flavorText: "blessed by the dairy gods. nothing can counter you today.",                          effect: { type: 'raid_shield',    value: 1    }, duration: 24 * 60 * 60 * 1000,    uses: null },
  sacred_rune:     { name: "Sacred Cheese Rune",     tier: 'RARE',      price: 4500,   emoji: '🔮',  description: '+100% XP for 12 hr',                         flavorText: "inscribed in aged gouda. the rune speaks. it says: more XP.",                       effect: { type: 'xp_mul',         value: 1.00 }, duration: 12 * 60 * 60 * 1000,    uses: null },
  moonmilk_crystal:{ name: "Moonmilk Crystal",       tier: 'RARE',      price: 7000,   emoji: '🌙',  description: '+200% jackpot chance for 12 hr',             flavorText: "charged by the moon. the jackpot is magnetized to you.",                             effect: { type: 'jackpot_mul',    value: 2.00 }, duration: 12 * 60 * 60 * 1000,    uses: null },
  brie_battleaxe:  { name: "Brie Battleaxe",         tier: 'RARE',      price: 8500,   emoji: '⚔️', description: '+200 flat raid damage, next 5 attacks',       flavorText: "forged in brie. five attacks. all deadly.",                                           effect: { type: 'raid_damage',    value: 200  }, duration: null,                     uses: 5    },
  cream_codex:     { name: "The Cream Codex",        tier: 'RARE',      price: 5500,   emoji: '📖',  description: '+50% earnings for next 3 wins',              flavorText: "ancient dairy scripture. the secrets inside mostly say: win more.",                    effect: { type: 'next_win_mul',   value: 0.50 }, duration: null,                     uses: 3    },
  berserker_seal:  { name: "Raid Berserker Seal",    tier: 'RARE',      price: 10000,  emoji: '🔴',  description: '2x all raid damage for 6 hr',                flavorText: "the seal is broken. you are the berserker now.",                                      effect: { type: 'raid_damage_mul', value: 1.0 }, duration: 6 * 60 * 60 * 1000,     uses: null },
  boss_plague:     { name: "Boss Plague Vial",       tier: 'RARE',      price: 8000,   emoji: '☠️', description: '☠️ Deal 800 HP to active boss (server-wide)', flavorText: "you're about to poison the dairy. 800 HP to the active boss. server-wide.",          effect: { type: 'boss_nuke',      value: 800  }, duration: null,                     uses: null },
  streak_belt:     { name: "Streak Immortality Belt",tier: 'RARE',      price: 5500,   emoji: '🔱',  description: 'Protect hot streak from 3 losses',           flavorText: "three losses. absorbed. your streak survives. this time.",                            effect: { type: 'streak_shield',  value: 1    }, duration: null,                     uses: 3    },
  drake_scales:    { name: "Cream Drake Scales",     tier: 'RARE',      price: 9500,   emoji: '🐉',  description: '+50% earnings + +50% XP for 6 hr',           flavorText: "scales of the cream drake. legendary beast. legendary gains.",                       effect: { type: 'combo_surge',    value: 0.50 }, duration: 6 * 60 * 60 * 1000,     uses: null },
  grand_shield:    { name: "Grand Butter Shield",    tier: 'RARE',      price: 14000,  emoji: '🛡️', description: 'Immune to all raid counters for 48 hr',       flavorText: "the grand shield. two days of invincibility. dairy-forged.",                         effect: { type: 'raid_shield',    value: 1    }, duration: 48 * 60 * 60 * 1000,    uses: null },

  // ── LEGENDARY (18,000–75,000 mb) ────────────────────────────────────────────
  infinite_jug:      { name: "The Infinite Jug",       tier: 'LEGENDARY', price: 35000,  emoji: '♾️', description: '+100% all earnings for 7 days',              flavorText: "it never empties. your bank account will. then refill. repeat.",                      effect: { type: 'earnings_mul',   value: 1.00 }, duration: 7 * 24 * 60 * 60 * 1000, uses: null },
  milk_gods_blessing:{ name: "Milk God's Blessing",    tier: 'LEGENDARY', price: 20000,  emoji: '👼',  description: '8x earnings, very next single win',           flavorText: "the milk god looked at you. nodded. gave you 8x. don't waste it.",                  effect: { type: 'next_win_mul',   value: 7.00 }, duration: null,                     uses: 1    },
  cursed_cream_orb:  { name: "Cursed Cream Orb",       tier: 'LEGENDARY', price: 18000,  emoji: '🔮',  description: '50/50: 10x next win OR earn nothing (risky)', flavorText: "cursed. 50% chance at 10x. 50% chance at crying. roll the dairy dice.",             effect: { type: 'cursed_orb',     value: 9.00 }, duration: null,                     uses: null },
  butter_eternity:   { name: "Butter of Eternity",     tier: 'LEGENDARY', price: 40000,  emoji: '🌠',  description: '+300% jackpot chance for 7 days',            flavorText: "eternal butter. eternal luck. the jackpot fears you.",                               effect: { type: 'jackpot_mul',    value: 3.00 }, duration: 7 * 24 * 60 * 60 * 1000, uses: null },
  almighty_moo:      { name: "The Almighty Moo",        tier: 'LEGENDARY', price: 50000,  emoji: '🐮',  description: '+100% all earnings for 24 hr',               flavorText: "moo. that's all it says. it gives you +100%. that's enough.",                       effect: { type: 'earnings_mul',   value: 1.00 }, duration: 24 * 60 * 60 * 1000,    uses: null },
  grand_tome:        { name: "Grand Dairy Tome",        tier: 'LEGENDARY', price: 30000,  emoji: '📚',  description: '3x all raid damage for 24 hr',               flavorText: "ancient dairy knowledge. translated: hit harder.",                                    effect: { type: 'raid_damage_mul', value: 2.0 }, duration: 24 * 60 * 60 * 1000,    uses: null },
  moo_ascension:     { name: "Moo Ascension Relic",     tier: 'LEGENDARY', price: 45000,  emoji: '🌟',  description: '+100% XP for 7 days',                        flavorText: "ascend. the XP rains down. for an entire week.",                                     effect: { type: 'xp_mul',         value: 1.00 }, duration: 7 * 24 * 60 * 60 * 1000, uses: null },
  sacred_udder:      { name: "The Sacred Udder",        tier: 'LEGENDARY', price: 75000,  emoji: '⚜️', description: 'Immune to counters + +300% raid damage for 24 hr', flavorText: "sacred. holy. dairy. your raid damage is unhinged for one day.",            effect: { type: 'combo_raid',     value: 3.0  }, duration: 24 * 60 * 60 * 1000,    uses: null },
  dairy_plague:      { name: "The Dairy Plague",        tier: 'LEGENDARY', price: 60000,  emoji: '💀',  description: '☠️ Deal 5,000 HP to active boss (server-wide)', flavorText: "the plague spreads. 5,000 damage. server-wide. unstoppable.",                   effect: { type: 'boss_nuke',      value: 5000 }, duration: null,                     uses: null },
  milk_immortal:     { name: "Milk Immortal's Vow",     tier: 'LEGENDARY', price: 55000,  emoji: '🏆',  description: 'Hot streak can NEVER reset for 24 hr',        flavorText: "you vowed. you will not break. your streak will not break. for 24 hours.",          effect: { type: 'streak_shield',  value: 1    }, duration: 24 * 60 * 60 * 1000,    uses: null },
};

const TIER_EMOJI = { COMMON: '🟤', UNCOMMON: '🟢', RARE: '🔵', LEGENDARY: '🟡' };

// ── Data helpers ──────────────────────────────────────────────────────────────
function readData(p) {
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return {}; }
}
function writeData(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

// ── Buff helpers ──────────────────────────────────────────────────────────────
function _readBuffs(userId) {
  const all = readData(buffsPath);
  return all[userId] || [];
}

function _saveBuffs(userId, buffs) {
  const all = readData(buffsPath);
  all[userId] = buffs;
  writeData(buffsPath, all);
}

function _activeOnly(buffs) {
  const now = Date.now();
  return buffs.filter(b => {
    if (b.expiresAt !== null && b.expiresAt < now) return false;
    if (b.uses !== null && b.uses <= 0) return false;
    return true;
  });
}

function getActiveBuffs(userId, type = null) {
  const raw = _readBuffs(userId);
  const active = _activeOnly(raw);
  if (raw.length !== active.length) _saveBuffs(userId, active);
  return type ? active.filter(b => b.type === type) : active;
}

// ── Apply item on purchase ────────────────────────────────────────────────────
// Returns { ok, message } describing what happened.
function applyItemPurchase(userId, itemId) {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, message: 'unknown item' };

  const { type, value } = item.effect;
  const now = Date.now();

  // Items that go to inventory
  if (type === 'boss_nuke' || type === 'cursed_orb') {
    const inv = readData(inventoryPath);
    if (!inv[userId]) inv[userId] = {};
    inv[userId][itemId] = (inv[userId][itemId] || 0) + 1;
    writeData(inventoryPath, inv);
    return { ok: true, message: `added to your inventory. use it from \`/inv\` when you're ready.` };
  }

  // Instant cash — return the amount so caller can add to balance
  if (type === 'instant_cash') {
    return { ok: true, instant: value, message: `+${value.toLocaleString()} milk bucks added to your balance instantly. 🥛` };
  }

  // All other types: store in buffs.json
  const buffs = _readBuffs(userId);

  if (type === 'combo_surge') {
    const exp = item.duration ? now + item.duration : null;
    buffs.push({ itemId, type: 'earnings_mul', value, expiresAt: exp, uses: item.uses, label: item.name });
    buffs.push({ itemId, type: 'xp_mul',       value, expiresAt: exp, uses: item.uses, label: item.name });
  } else if (type === 'combo_raid') {
    const exp = item.duration ? now + item.duration : null;
    buffs.push({ itemId, type: 'raid_shield',    value: 1,   expiresAt: exp, uses: item.uses, label: item.name });
    buffs.push({ itemId, type: 'raid_damage_mul', value,     expiresAt: exp, uses: item.uses, label: item.name });
  } else {
    buffs.push({ itemId, type, value, expiresAt: item.duration ? now + item.duration : null, uses: item.uses, label: item.name });
  }

  _saveBuffs(userId, buffs);
  return { ok: true, message: `buff activated. 🥛` };
}

// ── Use item from inventory ───────────────────────────────────────────────────
// Returns { ok, type, value, message } — boss_nuke handled separately.
function useInventoryItem(userId, itemId) {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, message: 'unknown item' };

  const inv = readData(inventoryPath);
  const qty = (inv[userId] || {})[itemId] || 0;
  if (qty <= 0) return { ok: false, message: 'you don\'t have that item' };

  inv[userId][itemId] = qty - 1;
  if (inv[userId][itemId] <= 0) delete inv[userId][itemId];
  writeData(inventoryPath, inv);

  const { type, value } = item.effect;

  if (type === 'boss_nuke') {
    return { ok: true, type: 'boss_nuke', value, message: null };
  }

  if (type === 'cursed_orb') {
    const win = Math.random() < 0.5;
    if (win) {
      applyItemPurchase(userId, 'cursed_cream_orb'); // re-use buff apply? no — manual
      const buffs = _readBuffs(userId);
      buffs.push({ itemId, type: 'next_win_mul', value, expiresAt: null, uses: 1, label: 'Cursed Cream Orb (10x)' });
      _saveBuffs(userId, buffs);
      return { ok: true, type: 'cursed_orb', won: true, message: `🎉 **50/50 — YOU WIN!** The orb glows green. 10x buff applied to your next win. 🥛` };
    } else {
      return { ok: true, type: 'cursed_orb', won: false, message: `💀 **50/50 — YOU LOSE.** The orb shatters. No buff. cry about it. 🥛` };
    }
  }

  return { ok: false, message: 'this item cannot be used from inventory' };
}

// ── Buff readers ──────────────────────────────────────────────────────────────
function getEarningsMul(userId) {
  const active = getActiveBuffs(userId).filter(b => b.type === 'earnings_mul');
  return 1 + active.reduce((s, b) => s + b.value, 0);
}

function getXpMul(userId) {
  const active = getActiveBuffs(userId).filter(b => b.type === 'xp_mul');
  return 1 + active.reduce((s, b) => s + b.value, 0);
}

function getJackpotMul(userId) {
  const active = getActiveBuffs(userId).filter(b => b.type === 'jackpot_mul');
  return 1 + active.reduce((s, b) => s + b.value, 0);
}

// Reads next_win_mul without consuming. Returns 1 if none.
function getNextWinMul(userId) {
  const active = getActiveBuffs(userId, 'next_win_mul');
  if (!active.length) return 1;
  return 1 + active[0].value;
}

// Reads and consumes one next_win_mul use. Returns multiplier applied (1 if none).
function getAndConsumeNextWinMul(userId) {
  const now = Date.now();
  let buffs = _readBuffs(userId);
  buffs = _activeOnly(buffs);
  const idx = buffs.findIndex(b => b.type === 'next_win_mul');
  if (idx === -1) return 1;
  const mul = 1 + buffs[idx].value;
  if (buffs[idx].uses !== null) {
    buffs[idx].uses -= 1;
  }
  _saveBuffs(userId, _activeOnly(buffs));
  return mul;
}

function getDailyMul(userId) {
  const active = getActiveBuffs(userId, 'daily_mul');
  return 1 + active.reduce((s, b) => s + b.value, 0);
}

function consumeDailyMul(userId) {
  let buffs = _activeOnly(_readBuffs(userId));
  const idx = buffs.findIndex(b => b.type === 'daily_mul');
  if (idx === -1) return;
  if (buffs[idx].uses !== null) buffs[idx].uses -= 1;
  _saveBuffs(userId, _activeOnly(buffs));
}

function hasStreakShield(userId) {
  return getActiveBuffs(userId, 'streak_shield').length > 0;
}

function consumeStreakShield(userId) {
  let buffs = _activeOnly(_readBuffs(userId));
  // Prefer consuming use-count shields before timed ones
  const idx = buffs.findIndex(b => b.type === 'streak_shield' && b.uses !== null);
  if (idx !== -1) {
    buffs[idx].uses -= 1;
    _saveBuffs(userId, _activeOnly(buffs));
    return;
  }
  // Timed streak shield — don't consume (just check active)
}

function hasRaidShield(userId) {
  return getActiveBuffs(userId, 'raid_shield').length > 0;
}

function consumeRaidShield(userId) {
  let buffs = _activeOnly(_readBuffs(userId));
  // Consume one use-count shield first, otherwise leave timed shields untouched
  const idx = buffs.findIndex(b => b.type === 'raid_shield' && b.uses !== null);
  if (idx !== -1) {
    buffs[idx].uses -= 1;
    _saveBuffs(userId, _activeOnly(buffs));
  }
  // Timed raid_shield stays active (no consumption)
}

// Returns { flatBonus, mulBonus } and consumes one use from use-count raid buffs.
function applyRaidBonuses(userId) {
  let buffs = _activeOnly(_readBuffs(userId));
  let flatBonus = 0;
  let mulBonus = 1;
  const now = Date.now();

  buffs = buffs.map(b => {
    if (b.type === 'raid_damage') {
      flatBonus += b.value;
      if (b.uses !== null) return { ...b, uses: b.uses - 1 };
    }
    if (b.type === 'raid_damage_timed') {
      flatBonus += b.value;
      // timed — no use decrement
    }
    if (b.type === 'raid_damage_mul') {
      mulBonus += b.value;
      if (b.uses !== null) return { ...b, uses: b.uses - 1 };
    }
    return b;
  });

  _saveBuffs(userId, _activeOnly(buffs));
  return { flatBonus, mulBonus };
}

// ── Active buff summary for game result lines ─────────────────────────────────
function getBuffSummary(userId) {
  const buffs = getActiveBuffs(userId);
  const parts = [];

  const eMul = buffs.filter(b => b.type === 'earnings_mul').reduce((s, b) => s + b.value, 0);
  const nMul = buffs.filter(b => b.type === 'next_win_mul').reduce((s, b) => s + b.value, 0);
  const xMul = buffs.filter(b => b.type === 'xp_mul').reduce((s, b) => s + b.value, 0);
  const jMul = buffs.filter(b => b.type === 'jackpot_mul').reduce((s, b) => s + b.value, 0);

  if (eMul > 0 || nMul > 0) parts.push(`+${Math.round((eMul + nMul) * 100)}% earnings`);
  if (xMul > 0) parts.push(`+${Math.round(xMul * 100)}% XP`);
  if (jMul > 0) parts.push(`+${Math.round(jMul * 100)}% jackpot`);

  return parts.length ? `🛒 ${parts.join(' · ')}` : '';
}

// ── Inventory helpers ─────────────────────────────────────────────────────────
function getInventory(userId) {
  return (readData(inventoryPath)[userId]) || {};
}

// ── Daily shop rotation ───────────────────────────────────────────────────────
function _todayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function _seededRng(seed) {
  const n = parseInt(String(seed).replace(/-/g, ''), 10) || 20260101;
  let s = n;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0x100000000;
  };
}

function _seededShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getTodaySlots() {
  const today = _todayEST();
  const state = readData(shopstatePath);
  if (state.date === today && Array.isArray(state.slots) && state.slots.length === 6) {
    return state.slots;
  }

  const rng = _seededRng(today);
  const byTier = { COMMON: [], UNCOMMON: [], RARE: [], LEGENDARY: [] };
  for (const [id, item] of Object.entries(ITEMS)) {
    // boss_nuke items never appear in daily rotation (they're inventory-only)
    if (item.effect.type !== 'boss_nuke') byTier[item.tier].push(id);
  }

  const commons   = _seededShuffle(byTier.COMMON,   rng).slice(0, 2);
  const uncommons = _seededShuffle(byTier.UNCOMMON,  rng).slice(0, 2);
  const rarePool  = _seededShuffle(byTier.RARE, rng);
  const rare1     = rarePool[0];
  // Slot 6: 25% legendary, 75% rare (different item)
  const isLeg     = rng() < 0.25;
  const slot6     = isLeg
    ? _seededShuffle(byTier.LEGENDARY, rng)[0]
    : (rarePool[1] ?? rarePool[0]);

  const slots = [...commons, ...uncommons, rare1, slot6];
  writeData(shopstatePath, { date: today, slots });
  return slots;
}

// Regenerate slots for a new day (called at midnight reset).
function regenerateSlots() {
  if (fs.existsSync(shopstatePath)) fs.unlinkSync(shopstatePath);
  return getTodaySlots();
}

// ── Shop board text builder ───────────────────────────────────────────────────
function buildShopBoardText() {
  const slots = getTodaySlots();
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const lines = [
    `🏪 **THE MILK MARKET — DAILY DEALS** 🏪`,
    `*the dairy economy does not sleep. 🥛*`,
    ``,
  ];
  for (const id of slots) {
    const item = ITEMS[id];
    if (!item) continue;
    lines.push(`${TIER_EMOJI[item.tier]} **${item.tier}**  ·  ${item.emoji} ${item.name}  —  **${item.price.toLocaleString()} 🥛**`);
    lines.push(`> *${item.description}*`);
  }
  lines.push(``);
  lines.push(`refreshes at midnight EST · use \`/shop\` to browse · \`/inv\` for your stash 🥛`);
  lines.push(`*updated: ${now} EST*`);
  return lines.join('\n');
}

module.exports = {
  ITEMS, TIER_EMOJI,
  getActiveBuffs, applyItemPurchase, useInventoryItem,
  getEarningsMul, getXpMul, getJackpotMul,
  getNextWinMul, getAndConsumeNextWinMul,
  getDailyMul, consumeDailyMul,
  hasStreakShield, consumeStreakShield,
  hasRaidShield, consumeRaidShield,
  applyRaidBonuses,
  getBuffSummary, getInventory,
  getTodaySlots, regenerateSlots, buildShopBoardText,
};
