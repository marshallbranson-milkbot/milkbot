// Enemy definitions. Base stats + behavior function. Behavior returns an action each turn.
// Combat engine calls enemy.behavior(ctx) on their turn and applies the returned effects.

const ENEMIES = {
  curdling: {
    key: 'curdling',
    name: 'Curdling',
    emoji: '🧫',
    role: 'Swarm',
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
    base: { hp: 40, atk: 10, def: 3, spd: 11 },
    tier: 3,
    threat: 1.3,
    lootWeight: 1.1,
    behavior: (ctx) => {
      const target = ctx.pickLivingPlayer();
      if (!target) return [];
      // 50% regular hit, 50% curdle (skip next turn)
      if (ctx.rng.chance(0.5)) {
        return [{ kind: 'status', target: target.userId, status: 'curdled', duration: 1 }];
      }
      return [{ kind: 'damage', target: target.userId, amount: ctx.atk }];
    },
  },
};

function getEnemy(key) { return ENEMIES[key]; }
function listEnemies() { return Object.values(ENEMIES); }
function enemiesByTier(tier) { return Object.values(ENEMIES).filter(e => e.tier === tier); }

module.exports = { ENEMIES, getEnemy, listEnemies, enemiesByTier };
