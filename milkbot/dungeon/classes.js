// Class definitions — base stats and ability handlers.
// Stats scale per floor via combat.js's scaling formula. Ability handlers are pure functions
// that return a list of effects; combat.js applies them.

const CLASSES = {
  creamlord: {
    key: 'creamlord',
    name: 'Creamlord',
    role: 'Tank',
    emoji: '🥛',
    description: 'Soaks damage and protects the party. High HP, high defense, slow.',
    base: { hp: 120, atk: 14, def: 12, spd: 6 },
    abilities: [
      {
        key: 'taunt',
        name: 'Taunt',
        description: 'Force next enemy attacks to target self. +10 DEF for 1 turn.',
        cooldown: 3,
        run: (ctx) => [
          { kind: 'status', target: 'self', status: 'taunting', duration: 1 },
          { kind: 'buff', target: 'self', stat: 'def', amount: 10, duration: 1 },
        ],
      },
      {
        key: 'dairy_wall',
        name: 'Dairy Wall',
        description: 'Shield an ally. Blocks the next hit against them.',
        cooldown: 3,
        targetKind: 'ally',
        run: (ctx) => [
          { kind: 'status', target: ctx.targetId, status: 'shielded', duration: 99 },
        ],
      },
    ],
    unlockedByDefault: true,
  },
  whey_reaver: {
    key: 'whey_reaver',
    name: 'Whey Reaver',
    role: 'DPS',
    emoji: '⚔️',
    description: 'Glass cannon single-target damage. Finisher deletes wounded foes.',
    base: { hp: 80, atk: 22, def: 4, spd: 10 },
    abilities: [
      {
        key: 'finisher',
        name: 'Finisher',
        description: '2× damage on enemies below 30% HP. Otherwise normal attack.',
        cooldown: 2,
        targetKind: 'enemy',
        run: (ctx) => {
          const target = ctx.enemies.find(e => e.id === ctx.targetId);
          const below = target && (target.hp / target.maxHp) < 0.30;
          return [{ kind: 'damage', target: ctx.targetId, amount: ctx.atk * (below ? 2.0 : 1.0) }];
        },
      },
      {
        key: 'overclock',
        name: 'Overclock',
        description: '+50% ATK this turn. Costs 2 HP (self).',
        cooldown: 3,
        run: (ctx) => [
          { kind: 'buff', target: 'self', stat: 'atk', amount: Math.floor(ctx.atk * 0.5), duration: 1 },
          { kind: 'damage', target: 'self', amount: 2, unblockable: true },
          { kind: 'status', target: 'self', status: 'overclocked', duration: 1 },
        ],
      },
    ],
    unlockedByDefault: true,
  },
  curd_medic: {
    key: 'curd_medic',
    name: 'Curd Medic',
    role: 'Healer',
    emoji: '💉',
    description: 'Keeps the party alive. Heals, cleanses, revives.',
    base: { hp: 90, atk: 8, def: 6, spd: 8 },
    abilities: [
      {
        key: 'milk_transfusion',
        name: 'Milk Transfusion',
        description: 'Heal an ally for 40 HP and cleanse status effects.',
        cooldown: 2,
        targetKind: 'ally',
        run: (ctx) => [
          { kind: 'heal', target: ctx.targetId, amount: 40 },
          { kind: 'cleanse', target: ctx.targetId },
        ],
      },
      {
        key: 'revive',
        name: 'Revive',
        description: 'Revive a downed ally at 50% HP.',
        cooldown: 3,
        targetKind: 'ally_downed',
        run: (ctx) => [
          { kind: 'revive', target: ctx.targetId, hpPct: 0.5 },
        ],
      },
    ],
    unlockLabel: 'Clear floor 5 once',
    unlockedByDefault: false,
  },
  lactic_mage: {
    key: 'lactic_mage',
    name: 'Lactic Mage',
    role: 'AoE',
    emoji: '✨',
    description: 'Area damage and status control. Hits everything, curses everyone.',
    base: { hp: 75, atk: 16, def: 4, spd: 7 },
    abilities: [
      {
        key: 'souring_blast',
        name: 'Souring Blast',
        description: 'Hit all enemies for 0.7× ATK and apply Sour (damage-over-time).',
        cooldown: 2,
        run: (ctx) => ctx.enemies.flatMap(e => [
          { kind: 'damage', target: e.id, amount: Math.floor(ctx.atk * 0.7) },
          { kind: 'status', target: e.id, status: 'sour', duration: 3 },
        ]),
      },
      {
        key: 'curdle',
        name: 'Curdle',
        description: 'Freeze one enemy. They skip their next turn.',
        cooldown: 3,
        targetKind: 'enemy',
        run: (ctx) => [
          { kind: 'status', target: ctx.targetId, status: 'curdled', duration: 1 },
        ],
      },
    ],
    unlockLabel: 'Beat the Curdfather',
    unlockedByDefault: false,
  },
};

function getClass(key) { return CLASSES[key]; }
function listClasses() { return Object.values(CLASSES); }
function defaultUnlockedKeys() { return Object.values(CLASSES).filter(c => c.unlockedByDefault).map(c => c.key); }

module.exports = { CLASSES, getClass, listClasses, defaultUnlockedKeys };
