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
      {
        key: 'milk_fortress',
        name: 'Milk Fortress',
        description: '+15 DEF to the entire party for 2 turns.',
        cooldown: 4,
        unlockedBy: 'creamlord_3',
        run: (ctx) => ctx.party.filter(p => !p.downed).map(p => ({
          kind: 'buff', target: p.userId, stat: 'def', amount: 15, duration: 2,
        })),
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
      {
        key: 'blood_mist',
        name: 'Blood Mist',
        description: 'Hit all enemies for 1.2× ATK.',
        cooldown: 3,
        unlockedBy: 'whey_reaver_3',
        run: (ctx) => ctx.enemies.filter(e => e.hp > 0).map(e => ({
          kind: 'damage', target: e.id, amount: Math.floor(ctx.atk * 1.2),
        })),
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
      {
        key: 'mass_transfusion',
        name: 'Mass Transfusion',
        description: 'Heal entire party 25 HP and cleanse all status effects.',
        cooldown: 4,
        unlockedBy: 'curd_medic_3',
        run: (ctx) => ctx.party.flatMap(p => [
          { kind: 'heal', target: p.userId, amount: 25 },
          { kind: 'cleanse', target: p.userId },
        ]),
      },
    ],
    unlockLabel: 'Clear Spoiled Vault floor 5 (The Lactose Lich)',
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
      {
        key: 'curdstorm',
        name: 'Curdstorm',
        description: 'Hit all enemies for 1× ATK, apply Sour AND Curdled.',
        cooldown: 5,
        unlockedBy: 'lactic_mage_3',
        run: (ctx) => ctx.enemies.filter(e => e.hp > 0).flatMap(e => [
          { kind: 'damage', target: e.id, amount: ctx.atk },
          { kind: 'status', target: e.id, status: 'sour', duration: 3 },
          { kind: 'status', target: e.id, status: 'curdled', duration: 1 },
        ]),
      },
    ],
    unlockLabel: 'Beat the Curdfather (Spoiled Vault floor 10)',
    unlockedByDefault: false,
  },
  frothmancer: {
    key: 'frothmancer',
    name: 'Frothmancer',
    role: 'Summoner',
    emoji: '🫧',
    description: 'Summons minions to fight alongside. Sacrifice them to sustain.',
    base: { hp: 85, atk: 14, def: 5, spd: 8 },
    abilities: [
      {
        key: 'summon_frothling',
        name: 'Summon Frothling',
        description: 'Spawn a 50 HP / 8 ATK minion that attacks each round (max 1 active).',
        cooldown: 3,
        run: (ctx) => [{ kind: 'summon', enemyKey: '_frothling_ally', allied: true }],
      },
      {
        key: 'sacrifice',
        name: 'Sacrifice',
        description: 'Destroy your active summon to heal 50% of your max HP.',
        cooldown: 4,
        run: (ctx) => [{ kind: 'sacrifice_summon', caster: ctx.self?.userId }],
      },
      {
        key: 'frothing_legion',
        name: 'Frothing Legion',
        description: 'Summon 2 additional minions (bypasses 1-max cap).',
        cooldown: 5,
        unlockedBy: 'frothmancer_3',
        run: (ctx) => [
          { kind: 'summon', enemyKey: '_frothling_ally', allied: true, force: true },
          { kind: 'summon', enemyKey: '_frothling_ally', allied: true, force: true },
        ],
      },
    ],
    unlockLabel: 'Clear Udder Abyss floor 5 (The Great Maw)',
    unlockedByDefault: false,
  },
  whey_warden: {
    key: 'whey_warden',
    name: 'Whey Warden',
    role: 'Counter-Attacker',
    emoji: '🛡️',
    description: 'Reflects damage. Punishes aggression.',
    base: { hp: 100, atk: 16, def: 8, spd: 7 },
    abilities: [
      {
        key: 'riposte',
        name: 'Riposte',
        description: 'Next incoming attack triggers a 1.5× ATK counter.',
        cooldown: 2,
        run: (ctx) => [{ kind: 'status', target: 'self', status: 'riposte', duration: 2, meta: { mul: 1.5 } }],
      },
      {
        key: 'bulwark',
        name: 'Bulwark',
        description: 'For 2 turns, every incoming hit counters for 1× ATK.',
        cooldown: 4,
        run: (ctx) => [{ kind: 'status', target: 'self', status: 'bulwark', duration: 2 }],
      },
      {
        key: 'untouchable',
        name: 'Untouchable',
        description: 'For 2 turns, reflect all damage back to attackers.',
        cooldown: 5,
        unlockedBy: 'whey_warden_3',
        run: (ctx) => [{ kind: 'status', target: 'self', status: 'untouchable', duration: 2 }],
      },
    ],
    unlockLabel: 'Beat the Udder God (Udder Abyss floor 10)',
    unlockedByDefault: false,
  },
};

function getClass(key) { return CLASSES[key]; }
function listClasses() { return Object.values(CLASSES); }
function defaultUnlockedKeys() { return Object.values(CLASSES).filter(c => c.unlockedByDefault).map(c => c.key); }

module.exports = { CLASSES, getClass, listClasses, defaultUnlockedKeys };
