// Enemy definitions. Base stats + behavior function. Behavior returns an action each turn.
// Combat engine calls enemy.behavior(ctx) on their turn and applies the returned effects.

// Enemies are tagged with `dungeons: [...]` so rooms can filter by the run's dungeonId.
// If absent, defaults to ['spoiled_vault'] for legacy.

const ENEMIES = {
  curdling: {
    key: 'curdling',
    name: 'Curdling',
    emoji: '🧫',
    role: 'Swarm',
    dungeons: ['spoiled_vault'],
    base: { hp: 30, atk: 8, def: 2, spd: 5 },
    tier: 1,
    threat: 1,
    lootWeight: 1,
    behavior: (ctx) => {
      // Basic attacker — pick a random living player
      const target = ctx.pickLivingPlayer();
      if (!target) return [];
      return [{ kind: 'damage', target: target.userId, amount: ctx.atk }];
    },
  },
  spoiled_rotter: {
    key: 'spoiled_rotter',
    name: 'Spoiled Rotter',
    emoji: '🤢',
    role: 'Poisoner',
    base: { hp: 45, atk: 10, def: 3, spd: 4 },
    tier: 2,
    threat: 1.3,
    lootWeight: 1,
    behavior: (ctx) => {
      const target = ctx.pickLivingPlayer();
      if (!target) return [];
      return [
        { kind: 'damage', target: target.userId, amount: ctx.atk },
        { kind: 'status', target: target.userId, status: 'sour', duration: 2 },
      ];
    },
  },
  whey_wraith: {
    key: 'whey_wraith',
    name: 'Whey Wraith',
    emoji: '👻',
    role: 'Evasive',
    base: { hp: 40, atk: 14, def: 2, spd: 12 },
    tier: 2,
    threat: 1.4,
    lootWeight: 1,
    extras: { dodgeChance: 0.3 },
    behavior: (ctx) => {
      const target = ctx.pickLivingPlayer();
      if (!target) return [];
      return [{ kind: 'damage', target: target.userId, amount: ctx.atk }];
    },
  },
  lactose_hatchling: {
    key: 'lactose_hatchling',
    name: 'Lactose Hatchling',
    emoji: '🐣',
    role: 'Support',
    base: { hp: 35, atk: 4, def: 4, spd: 6 },
    tier: 2,
    threat: 1.2,
    lootWeight: 1,
    behavior: (ctx) => {
      // Heals the most-wounded ally enemy. Falls back to basic attack if everyone's full.
      const wounded = ctx.enemies
        .filter(e => e.id !== ctx.selfId && e.hp > 0 && e.hp < e.maxHp)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (wounded) {
        return [{ kind: 'heal', target: wounded.id, amount: 15 }];
      }
      const target = ctx.pickLivingPlayer();
      if (!target) return [];
      return [{ kind: 'damage', target: target.userId, amount: ctx.atk }];
    },
  },
  butterfiend: {
    key: 'butterfiend',
    name: 'Butterfiend',
    emoji: '🧈',
    role: 'Bruiser',
    base: { hp: 80, atk: 16, def: 8, spd: 3 },
    tier: 3,
    threat: 1.6,
    lootWeight: 1.3,
    behavior: (ctx) => {
      const target = ctx.pickLivingPlayer();
      if (!target) return [];
      return [{ kind: 'damage', target: target.userId, amount: Math.floor(ctx.atk * 1.2) }];
    },
  },
  mold_shade: {
    key: 'mold_shade',
    name: 'Mold Shade',
    emoji: '🫥',
    role: 'Glass Cannon',
    base: { hp: 25, atk: 20, def: 1, spd: 9 },
    tier: 3,
    threat: 1.5,
    lootWeight: 1.2,
    extras: { critChance: 0.4 },
    behavior: (ctx) => {
      const target = ctx.pickLivingPlayer();
      if (!target) return [];
      return [{ kind: 'damage', target: target.userId, amount: ctx.atk, critChance: 0.4 }];
    },
  },
  skim_revenant: {
    key: 'skim_revenant',
    name: 'Skim Revenant',
    emoji: '☠️',
    role: 'Disruptor',
    base: { hp: 55, atk: 12, def: 5, spd: 7 },
    tier: 3,
    threat: 1.5,
    lootWeight: 1.2,
    behavior: (ctx) => {
      // Strip buffs from a random player, then weak attack
      const target = ctx.pickLivingPlayer();
      if (!target) return [];
      return [
        { kind: 'strip_buffs', target: target.userId },
        { kind: 'damage', target: target.userId, amount: Math.floor(ctx.atk * 0.7) },
      ];
    },
  },
  frothling: {
    key: 'frothling',
    name: 'Frothling',
    emoji: '🫧',
    role: 'Trickster',
    dungeons: ['spoiled_vault'],
    base: { hp: 40, atk: 10, def: 3, spd: 11 },
    tier: 3,
    threat: 1.3,
    lootWeight: 1.1,
    behavior: (ctx) => {
      const target = ctx.pickLivingPlayer();
      if (!target) return [];
      if (ctx.rng.chance(0.5)) {
        return [{ kind: 'status', target: target.userId, status: 'curdled', duration: 1 }];
      }
      return [{ kind: 'damage', target: target.userId, amount: ctx.atk }];
    },
  },

  // ── UDDER ABYSS ENEMIES ─────────────────────────────────────────────────────
  ooze_calf: {
    key: 'ooze_calf', name: 'Ooze Calf', emoji: '🐮', role: 'Swarm',
    dungeons: ['udder_abyss'],
    base: { hp: 38, atk: 10, def: 3, spd: 5 }, tier: 1, threat: 1.1, lootWeight: 1,
    behavior: (ctx) => { const t = ctx.pickLivingPlayer(); return t ? [{ kind: 'damage', target: t.userId, amount: ctx.atk }] : []; },
  },
  curdborn: {
    key: 'curdborn', name: 'Curdborn', emoji: '👶', role: 'Poisoner',
    dungeons: ['udder_abyss'],
    base: { hp: 52, atk: 12, def: 4, spd: 5 }, tier: 2, threat: 1.4, lootWeight: 1.1,
    behavior: (ctx) => {
      const t = ctx.pickLivingPlayer(); if (!t) return [];
      return [
        { kind: 'damage', target: t.userId, amount: ctx.atk },
        { kind: 'status', target: t.userId, status: 'sour', duration: 3 },
      ];
    },
  },
  whey_shambler: {
    key: 'whey_shambler', name: 'Whey Shambler', emoji: '🧟', role: 'Bruiser',
    dungeons: ['udder_abyss'],
    base: { hp: 90, atk: 18, def: 9, spd: 3 }, tier: 3, threat: 1.7, lootWeight: 1.4,
    behavior: (ctx) => { const t = ctx.pickLivingPlayer(); return t ? [{ kind: 'damage', target: t.userId, amount: Math.floor(ctx.atk * 1.2) }] : []; },
  },
  fetasaur: {
    key: 'fetasaur', name: 'Fetasaur', emoji: '🦕', role: 'Heavy Hitter',
    dungeons: ['udder_abyss'],
    base: { hp: 75, atk: 22, def: 6, spd: 4 }, tier: 3, threat: 1.8, lootWeight: 1.5,
    behavior: (ctx) => { const t = ctx.pickLivingPlayer(); return t ? [{ kind: 'damage', target: t.userId, amount: Math.floor(ctx.atk * 1.3) }] : []; },
  },
  bile_wisp: {
    key: 'bile_wisp', name: 'Bile Wisp', emoji: '💚', role: 'Evasive',
    dungeons: ['udder_abyss'],
    base: { hp: 42, atk: 15, def: 2, spd: 13 }, tier: 2, threat: 1.5, lootWeight: 1.2,
    extras: { dodgeChance: 0.35 },
    behavior: (ctx) => { const t = ctx.pickLivingPlayer(); return t ? [{ kind: 'damage', target: t.userId, amount: ctx.atk }] : []; },
  },
  spoilmaw: {
    key: 'spoilmaw', name: 'Spoilmaw', emoji: '🕳️', role: 'Devourer',
    dungeons: ['udder_abyss'],
    base: { hp: 60, atk: 16, def: 5, spd: 6 }, tier: 3, threat: 1.6, lootWeight: 1.3,
    behavior: (ctx) => {
      const t = ctx.pickLivingPlayer(); if (!t) return [];
      // 25% chance to banish (apply curdled 2 turns), else heavy hit
      if (ctx.rng.chance(0.25)) {
        return [{ kind: 'status', target: t.userId, status: 'curdled', duration: 2 }];
      }
      return [{ kind: 'damage', target: t.userId, amount: Math.floor(ctx.atk * 1.1) }];
    },
  },
  dairy_ghoul: {
    key: 'dairy_ghoul', name: 'Dairy Ghoul', emoji: '👻', role: 'Anti-healer',
    dungeons: ['udder_abyss'],
    base: { hp: 58, atk: 14, def: 5, spd: 8 }, tier: 3, threat: 1.6, lootWeight: 1.3,
    behavior: (ctx) => {
      const t = ctx.pickLivingPlayer(); if (!t) return [];
      return [
        { kind: 'strip_buffs', target: t.userId },
        { kind: 'damage', target: t.userId, amount: Math.floor(ctx.atk * 0.8) },
      ];
    },
  },
  gloom_udder: {
    key: 'gloom_udder', name: 'Gloom Udder', emoji: '🌑', role: 'Dread',
    dungeons: ['udder_abyss'],
    base: { hp: 70, atk: 18, def: 7, spd: 5 }, tier: 3, threat: 1.7, lootWeight: 1.4,
    behavior: (ctx) => {
      const t = ctx.pickLivingPlayer(); if (!t) return [];
      return [
        { kind: 'damage', target: t.userId, amount: ctx.atk },
        { kind: 'status', target: t.userId, status: 'sour', duration: 2 },
      ];
    },
  },
};

function getEnemy(key) { return ENEMIES[key]; }
function listEnemies() { return Object.values(ENEMIES); }
function enemiesByTier(tier, dungeonId = null) {
  return Object.values(ENEMIES).filter(e => {
    if (e.tier !== tier) return false;
    if (!dungeonId) return true;
    const dungeons = e.dungeons || ['spoiled_vault'];
    return dungeons.includes(dungeonId);
  });
}

module.exports = { ENEMIES, getEnemy, listEnemies, enemiesByTier };
