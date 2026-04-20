// Loot system — consumables (one-use) and relics (run-persistent passives).
// Drop rolls happen in combat.js (on enemy death) and rooms.js (treasure room).

const CONSUMABLES = {
  healing_milk_potion: {
    key: 'healing_milk_potion',
    name: 'Healing Milk Potion',
    emoji: '🥤',
    description: 'Restore 40 HP to yourself.',
    rarity: 'common',
    targetKind: 'self',
    use: (ctx) => [{ kind: 'heal', target: ctx.userId, amount: 40 }],
  },
  curdle_bomb: {
    key: 'curdle_bomb',
    name: 'Curdle Bomb',
    emoji: '💣',
    description: 'Hit all enemies for 20 damage.',
    rarity: 'uncommon',
    targetKind: 'none',
    use: (ctx) => ctx.enemies.map(e => ({ kind: 'damage', target: e.id, amount: 20 })),
  },
  spoilproof_shield: {
    key: 'spoilproof_shield',
    name: 'Spoilproof Shield',
    emoji: '🛡️',
    description: 'Block the next hit against you.',
    rarity: 'uncommon',
    targetKind: 'self',
    use: (ctx) => [{ kind: 'status', target: ctx.userId, status: 'shielded', duration: 99 }],
  },
  revive_token: {
    key: 'revive_token',
    name: 'Revive Token',
    emoji: '✨',
    description: 'Revive a downed ally at 50% HP.',
    rarity: 'rare',
    targetKind: 'ally_downed',
    use: (ctx) => [{ kind: 'revive', target: ctx.targetId, hpPct: 0.5 }],
  },
  cheese_rope: {
    key: 'cheese_rope',
    name: 'Cheese Rope',
    emoji: '🧀',
    description: 'Escape the current combat. Skip to next room.',
    rarity: 'rare',
    targetKind: 'none',
    use: (ctx) => [{ kind: 'flee_combat' }],
  },
  lactaid: {
    key: 'lactaid',
    name: 'Lactaid',
    emoji: '💊',
    description: 'Cleanse all status effects from the party.',
    rarity: 'uncommon',
    targetKind: 'none',
    use: (ctx) => ctx.party.map(p => ({ kind: 'cleanse', target: p.userId })),
  },
};

const RELICS = {
  cheese_crown: {
    key: 'cheese_crown',
    name: 'Cheese Crown',
    emoji: '👑',
    description: '+10% attack for the party.',
    rarity: 'common',
    apply: (ctx) => { ctx.partyAtkMul *= 1.10; },
  },
  whey_amulet: {
    key: 'whey_amulet',
    name: 'Whey Amulet',
    emoji: '📿',
    description: '+20% max HP for the party (heals to new max).',
    rarity: 'common',
    apply: (ctx) => {
      for (const p of ctx.party) {
        const bonus = Math.floor(p.maxHp * 0.20);
        p.maxHp += bonus;
        p.hp = Math.min(p.maxHp, p.hp + bonus);
      }
    },
  },
  butter_boots: {
    key: 'butter_boots',
    name: 'Butter Boots',
    emoji: '👢',
    description: '+2 speed for the party.',
    rarity: 'uncommon',
    apply: (ctx) => { for (const p of ctx.party) p.spd += 2; },
  },
  skim_shard: {
    key: 'skim_shard',
    name: 'Skim Shard',
    emoji: '🔹',
    description: '+15% crit chance for the party.',
    rarity: 'uncommon',
    apply: (ctx) => { ctx.partyCritBonus += 0.15; },
  },
  curd_locket: {
    key: 'curd_locket',
    name: 'Curd Locket',
    emoji: '🔮',
    description: 'Once per run, an ally downed is auto-revived at 50% HP.',
    rarity: 'rare',
    apply: () => {},
    onEvent: { kind: 'ally_downed', oncePerRun: true, effect: (ctx) => ({ kind: 'revive', target: ctx.targetId, hpPct: 0.5 }) },
  },
  mold_censer: {
    key: 'mold_censer',
    name: 'Mold Censer',
    emoji: '🟢',
    description: 'All enemies start with Sour status.',
    rarity: 'rare',
    apply: () => {},
    onEvent: { kind: 'enemy_spawn', effect: (ctx) => ({ kind: 'status', target: ctx.enemyId, status: 'sour', duration: 99 }) },
  },
  rancid_draft: {
    key: 'rancid_draft',
    name: 'Rancid Draft',
    emoji: '🍺',
    description: '+30% damage on first hit of each combat.',
    rarity: 'uncommon',
    apply: () => {},
    onEvent: { kind: 'combat_start', effect: (ctx) => ({ kind: 'status', target: 'party', status: 'rancid_buff', duration: 1 }) },
  },
  frothing_chalice: {
    key: 'frothing_chalice',
    name: 'Frothing Chalice',
    emoji: '🏆',
    description: 'Heal 10 HP at the start of each floor.',
    rarity: 'common',
    apply: () => {},
    onEvent: { kind: 'floor_start', effect: (ctx) => ctx.party.map(p => ({ kind: 'heal', target: p.userId, amount: 10 })) },
  },
  spoil_sigil: {
    key: 'spoil_sigil',
    name: 'Spoil Sigil',
    emoji: '🔯',
    description: 'Sour damage-over-time ticks for 8 instead of 5.',
    rarity: 'uncommon',
    apply: (ctx) => { ctx.sourTickDamage = 8; },
  },
  lactose_tome: {
    key: 'lactose_tome',
    name: 'Lactose Tome',
    emoji: '📖',
    description: '+25% XP earned from this run.',
    rarity: 'common',
    apply: () => {},
    onEvent: { kind: 'run_end', effect: (ctx) => ({ kind: 'xp_mul', amount: 1.25 }) },
  },
  // ── MYTHIC RELICS (hardcore runs only — exclusive drops from bosses) ─────────
  crown_of_cream: {
    key: 'crown_of_cream',
    name: 'Crown of Cream',
    emoji: '👑',
    description: '2× damage to bosses. Hardcore only.',
    rarity: 'mythic',
    dungeon: 'spoiled_vault',
    apply: (ctx) => { ctx.bossDmgMul = 2.0; },
  },
  curdlords_scepter: {
    key: 'curdlords_scepter',
    name: "Curdlord's Scepter",
    emoji: '🔱',
    description: 'All ability cooldowns reduced by 1 turn. Hardcore only.',
    rarity: 'mythic',
    dungeon: 'spoiled_vault',
    apply: (ctx) => { ctx.cooldownReduction = 1; },
  },
  blood_butter: {
    key: 'blood_butter',
    name: 'Blood Butter',
    emoji: '🩸',
    description: 'Crits do 3× damage (up from 2×). Hardcore only.',
    rarity: 'mythic',
    dungeon: 'spoiled_vault',
    apply: (ctx) => { ctx.critMultiplier = 3.0; },
  },
  whole_milkway: {
    key: 'whole_milkway',
    name: 'The Whole Milkway',
    emoji: '🌌',
    description: '+50% max HP and +20% ATK for the whole party. Hardcore only.',
    rarity: 'mythic',
    dungeon: 'spoiled_vault',
    apply: (ctx) => {
      for (const p of ctx.party) {
        const bonus = Math.floor(p.maxHp * 0.5);
        p.maxHp += bonus; p.hp = Math.min(p.maxHp, p.hp + bonus);
      }
      ctx.partyAtkMul *= 1.20;
    },
  },
};

function listConsumables() { return Object.values(CONSUMABLES); }
function listRelics() { return Object.values(RELICS); }
function getConsumable(key) { return CONSUMABLES[key]; }
function getRelic(key) { return RELICS[key]; }

// Weighted drop pools by rarity
const RARITY_WEIGHTS = { common: 5, uncommon: 3, rare: 1, mythic: 0 };  // mythic never rolls from regular drops


function rollConsumableDrop(rng, rarityBias = 1) {
  const pool = listConsumables();
  const weighted = pool.map(c => ({
    item: c,
    weight: (RARITY_WEIGHTS[c.rarity] || 1) * rarityBias,
  }));
  return rng.weighted(weighted);
}

function rollRelicDrop(rng, rarityBias = 1) {
  const pool = listRelics().filter(r => r.rarity !== 'mythic');
  const weighted = pool.map(r => ({
    item: r,
    weight: (RARITY_WEIGHTS[r.rarity] || 1) * rarityBias,
  }));
  return rng.weighted(weighted);
}

// Mythic drop — hardcore-only, filtered by dungeonId if provided.
function rollMythicDrop(rng, dungeonId = null) {
  const pool = listRelics().filter(r =>
    r.rarity === 'mythic' && (!dungeonId || r.dungeon === dungeonId)
  );
  if (pool.length === 0) return null;
  return pool[rng.int(pool.length)];
}

module.exports = {
  CONSUMABLES,
  RELICS,
  listConsumables,
  listRelics,
  getConsumable,
  getRelic,
  rollConsumableDrop,
  rollRelicDrop,
  rollMythicDrop,
};
