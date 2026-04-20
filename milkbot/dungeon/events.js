// Event scenarios — choose-your-own encounters with d20 outcome tables.
// Each event has a title, description, 2-3 choices. Each choice rolls a d20 and applies outcome effects.

const EVENTS = [
  {
    key: 'expired_bottle',
    title: 'An Expired Bottle',
    description: "You find a milk bottle with an expiration date from three years ago. It's... pulsing.",
    choices: [
      {
        label: 'Drink it',
        emoji: '🥛',
        rollTable: [
          { min: 15, max: 20, text: 'Blessed sour milk — +20 HP, +1 SPD', effects: (ctx) => [{ kind: 'heal', target: ctx.chooserId, amount: 20 }, { kind: 'buff', target: ctx.chooserId, stat: 'spd', amount: 1, duration: 999 }] },
          { min: 5, max: 14, text: 'It was spoiled. Sour for 3 turns.', effects: (ctx) => [{ kind: 'status', target: ctx.chooserId, status: 'sour', duration: 3 }] },
          { min: 1, max: 4, text: 'Immediate regret. Lose 15 HP.', effects: (ctx) => [{ kind: 'damage', target: ctx.chooserId, amount: 15, unblockable: true }] },
        ],
      },
      { label: 'Pocket it', emoji: '🎒', rollTable: [{ min: 1, max: 20, text: 'Saved for later. +1 Healing Potion.', effects: (ctx) => [{ kind: 'grant_item', target: ctx.chooserId, item: 'healing_milk_potion' }] }] },
      { label: 'Smash it', emoji: '💥', rollTable: [{ min: 1, max: 20, text: 'Smashed. You feel righteous.', effects: () => [] }] },
    ],
  },
  {
    key: 'rusted_fridge',
    title: 'Rusted Fridge',
    description: 'An old fridge rattles from inside. Something wants out.',
    choices: [
      {
        label: 'Pry it open',
        emoji: '🚪',
        rollTable: [
          { min: 15, max: 20, text: 'A relic tumbles out!', effects: (ctx) => [{ kind: 'grant_relic' }] },
          { min: 8, max: 14, text: 'Empty. Just cold.', effects: () => [] },
          { min: 1, max: 7, text: 'It was a trap. Party takes 10 damage.', effects: (ctx) => ctx.party.map(p => ({ kind: 'damage', target: p.userId, amount: 10 })) },
        ],
      },
      { label: 'Walk past', emoji: '🚶', rollTable: [{ min: 1, max: 20, text: "The party keeps moving. Smart.", effects: () => [] }] },
    ],
  },
  {
    key: 'milkmaid_ghost',
    title: 'The Milkmaid Ghost',
    description: "A translucent milkmaid beckons. 'Prove your worth, and I'll grant a wish.'",
    choices: [
      { label: 'Wish for gold', emoji: '💰', rollTable: [
        { min: 12, max: 20, text: '+500 milk bucks to party pot!', effects: (ctx) => [{ kind: 'pot_add', amount: 500 }] },
        { min: 1, max: 11, text: 'She laughs. Nothing happens.', effects: () => [] },
      ]},
      { label: 'Wish for power', emoji: '⚡', rollTable: [
        { min: 12, max: 20, text: '+3 ATK to whole party (rest of run)', effects: (ctx) => ctx.party.map(p => ({ kind: 'buff', target: p.userId, stat: 'atk', amount: 3, duration: 999 })) },
        { min: 1, max: 11, text: 'She takes 5 HP from each party member instead.', effects: (ctx) => ctx.party.map(p => ({ kind: 'damage', target: p.userId, amount: 5, unblockable: true })) },
      ]},
      { label: 'Decline', emoji: '❌', rollTable: [{ min: 1, max: 20, text: 'She fades with a smile.', effects: () => [] }] },
    ],
  },
  {
    key: 'cheese_vendor',
    title: 'Vagabond Cheesemonger',
    description: 'A wandering merchant offers a mystery cheese wheel for 300 milk bucks (from the pot).',
    choices: [
      {
        label: 'Buy it',
        emoji: '🧀',
        rollTable: [
          { min: 14, max: 20, text: 'Glorious cheese. Relic drop!', effects: (ctx) => [{ kind: 'pot_sub', amount: 300 }, { kind: 'grant_relic' }] },
          { min: 6, max: 13, text: 'Just ordinary cheese. Party heals 20 HP each.', effects: (ctx) => [{ kind: 'pot_sub', amount: 300 }, ...ctx.party.map(p => ({ kind: 'heal', target: p.userId, amount: 20 }))] },
          { min: 1, max: 5, text: 'It was cursed. -20 HP each.', effects: (ctx) => [{ kind: 'pot_sub', amount: 300 }, ...ctx.party.map(p => ({ kind: 'damage', target: p.userId, amount: 20, unblockable: true }))] },
        ],
      },
      { label: 'Pass', emoji: '🚫', rollTable: [{ min: 1, max: 20, text: 'He grumbles and moves on.', effects: () => [] }] },
    ],
  },
  {
    key: 'shrine_of_curd',
    title: 'Shrine of Curd',
    description: 'A small altar of solidified milk. It hums.',
    choices: [
      {
        label: 'Pray',
        emoji: '🙏',
        rollTable: [
          { min: 15, max: 20, text: 'Blessed. Full party heal.', effects: (ctx) => ctx.party.map(p => ({ kind: 'heal', target: p.userId, amount: 999 })) },
          { min: 8, max: 14, text: 'Mild blessing. +20 HP each.', effects: (ctx) => ctx.party.map(p => ({ kind: 'heal', target: p.userId, amount: 20 })) },
          { min: 1, max: 7, text: 'The curd rejects you. -10 HP each.', effects: (ctx) => ctx.party.map(p => ({ kind: 'damage', target: p.userId, amount: 10, unblockable: true })) },
        ],
      },
      { label: 'Desecrate', emoji: '🤘', rollTable: [
        { min: 12, max: 20, text: 'The shrine crumbles. +1 relic.', effects: () => [{ kind: 'grant_relic' }] },
        { min: 1, max: 11, text: 'A Curdling spawns and attacks!', effects: () => [{ kind: 'spawn_combat', enemies: ['curdling', 'curdling'] }] },
      ]},
      { label: 'Leave', emoji: '👋', rollTable: [{ min: 1, max: 20, text: 'Quietly walk away.', effects: () => [] }] },
    ],
  },
  {
    key: 'trapped_chest',
    title: 'Suspicious Chest',
    description: 'A chest sits in the middle of the room. Too conveniently.',
    choices: [
      { label: 'Open carefully', emoji: '🔍', rollTable: [
        { min: 10, max: 20, text: 'Clean pick. +1 consumable each.', effects: (ctx) => ctx.party.map(p => ({ kind: 'grant_item', target: p.userId, item: 'random' })) },
        { min: 1, max: 9, text: 'Trapped. Party takes 8 damage each.', effects: (ctx) => ctx.party.map(p => ({ kind: 'damage', target: p.userId, amount: 8 })) },
      ]},
      { label: 'Smash open', emoji: '💢', rollTable: [
        { min: 14, max: 20, text: 'Loot all over. +1 relic.', effects: () => [{ kind: 'grant_relic' }] },
        { min: 5, max: 13, text: 'Just rotted milk bottles. Nothing.', effects: () => [] },
        { min: 1, max: 4, text: 'It exploded. -20 HP each.', effects: (ctx) => ctx.party.map(p => ({ kind: 'damage', target: p.userId, amount: 20 })) },
      ]},
    ],
  },
  {
    key: 'dreaming_wraith',
    title: 'A Sleeping Wraith',
    description: 'A Whey Wraith is curled up, dreaming. You could rob it, or let it sleep.',
    choices: [
      { label: 'Pickpocket it', emoji: '🫳', rollTable: [
        { min: 13, max: 20, text: 'Clean steal! +500 to pot, +1 consumable.', effects: (ctx) => [{ kind: 'pot_add', amount: 500 }, { kind: 'grant_item', target: ctx.chooserId, item: 'random' }] },
        { min: 1, max: 12, text: 'It wakes up. Combat starts!', effects: () => [{ kind: 'spawn_combat', enemies: ['whey_wraith'] }] },
      ]},
      { label: 'Let it sleep', emoji: '😴', rollTable: [{ min: 1, max: 20, text: 'Peace preserved. +10 HP each (good karma).', effects: (ctx) => ctx.party.map(p => ({ kind: 'heal', target: p.userId, amount: 10 })) }] },
    ],
  },
  {
    key: 'runic_vat',
    title: 'Runic Milk Vat',
    description: 'A massive vat of glowing milk, inscribed with runes.',
    choices: [
      { label: 'Drink', emoji: '🥛', rollTable: [
        { min: 15, max: 20, text: 'Pure milk essence. Max HP +15 party.', effects: (ctx) => ctx.party.map(p => ({ kind: 'buff', target: p.userId, stat: 'maxHp', amount: 15, duration: 999 })) },
        { min: 1, max: 14, text: 'Tastes chalky. -5 HP.', effects: (ctx) => ctx.party.map(p => ({ kind: 'damage', target: p.userId, amount: 5, unblockable: true })) },
      ]},
      { label: 'Bathe', emoji: '🛁', rollTable: [
        { min: 10, max: 20, text: 'Refreshed. Full heal for chooser.', effects: (ctx) => [{ kind: 'heal', target: ctx.chooserId, amount: 999 }] },
        { min: 1, max: 9, text: 'Scalded. Chooser -15 HP.', effects: (ctx) => [{ kind: 'damage', target: ctx.chooserId, amount: 15, unblockable: true }] },
      ]},
      { label: 'Leave', emoji: '🚶', rollTable: [{ min: 1, max: 20, text: 'Walked past. Probably smart.', effects: () => [] }] },
    ],
  },
  {
    key: 'starved_calf',
    title: 'A Starving Calf',
    description: 'A tiny calf stumbles into your path, whining. It looks half-dead.',
    choices: [
      { label: 'Feed it (100 bucks)', emoji: '🍼', rollTable: [
        { min: 12, max: 20, text: "It's a Curdfather's child. +1 rare relic.", effects: () => [{ kind: 'pot_sub', amount: 100 }, { kind: 'grant_relic', rarityBias: 3 }] },
        { min: 1, max: 11, text: 'It eats and leaves. Good deed done.', effects: () => [{ kind: 'pot_sub', amount: 100 }] },
      ]},
      { label: 'Ignore it', emoji: '💔', rollTable: [{ min: 1, max: 20, text: 'The calf wilts and vanishes. No rewards.', effects: () => [] }] },
      { label: 'Attack it', emoji: '⚔️', rollTable: [
        { min: 15, max: 20, text: "It was a disguise! An enemy attacks!", effects: () => [{ kind: 'spawn_combat', enemies: ['butterfiend'] }] },
        { min: 1, max: 14, text: 'The calf dies pathetically. Everyone feels bad. -5 HP each.', effects: (ctx) => ctx.party.map(p => ({ kind: 'damage', target: p.userId, amount: 5, unblockable: true })) },
      ]},
    ],
  },
  {
    key: 'crossroads',
    title: 'Crossroads',
    description: 'Two paths: a stairwell down to the next floor, or a mysterious side room.',
    choices: [
      { label: 'Stairs', emoji: '⬇️', rollTable: [{ min: 1, max: 20, text: 'Continue safely.', effects: () => [] }] },
      { label: 'Side room', emoji: '🚪', rollTable: [
        { min: 15, max: 20, text: 'Treasure stash! +1 relic, +500 pot.', effects: () => [{ kind: 'pot_add', amount: 500 }, { kind: 'grant_relic' }] },
        { min: 5, max: 14, text: 'Empty side room. Oh well.', effects: () => [] },
        { min: 1, max: 4, text: 'Ambush! 2 enemies attack.', effects: () => [{ kind: 'spawn_combat', enemies: ['curdling', 'spoiled_rotter'] }] },
      ]},
    ],
  },
  {
    key: 'broken_bottle',
    title: 'A Broken Milk Bottle',
    description: 'Shards of glass and curdled milk everywhere. Looks like someone or something died here.',
    choices: [
      { label: 'Search the debris', emoji: '🔎', rollTable: [
        { min: 12, max: 20, text: 'Found a consumable.', effects: (ctx) => [{ kind: 'grant_item', target: ctx.chooserId, item: 'random' }] },
        { min: 5, max: 11, text: 'Nothing useful.', effects: () => [] },
        { min: 1, max: 4, text: 'Cut your hand. -5 HP.', effects: (ctx) => [{ kind: 'damage', target: ctx.chooserId, amount: 5, unblockable: true }] },
      ]},
      { label: 'Keep moving', emoji: '➡️', rollTable: [{ min: 1, max: 20, text: 'Onward.', effects: () => [] }] },
    ],
  },
  {
    key: 'ancient_churner',
    title: 'Ancient Butter Churner',
    description: 'A stone churner covered in moss. Inserting milk bucks spins it...',
    choices: [
      { label: 'Pay 300 bucks', emoji: '🪙', rollTable: [
        { min: 15, max: 20, text: 'JACKPOT. +1 rare relic.', effects: () => [{ kind: 'pot_sub', amount: 300 }, { kind: 'grant_relic', rarityBias: 3 }] },
        { min: 8, max: 14, text: 'Spits out a consumable.', effects: (ctx) => [{ kind: 'pot_sub', amount: 300 }, { kind: 'grant_item', target: ctx.chooserId, item: 'random' }] },
        { min: 1, max: 7, text: 'Nothing happens. Bucks lost.', effects: () => [{ kind: 'pot_sub', amount: 300 }] },
      ]},
      { label: 'Leave', emoji: '👋', rollTable: [{ min: 1, max: 20, text: 'Not worth the gamble.', effects: () => [] }] },
    ],
  },
  {
    key: 'sour_spring',
    title: 'A Sour Spring',
    description: 'Bubbling sour milk oozes from the floor. It smells... aggressive.',
    choices: [
      { label: 'Drink deeply', emoji: '🥛', rollTable: [
        { min: 14, max: 20, text: '+30 HP each, also gain Sour status.', effects: (ctx) => ctx.party.flatMap(p => [{ kind: 'heal', target: p.userId, amount: 30 }, { kind: 'status', target: p.userId, status: 'sour', duration: 2 }]) },
        { min: 1, max: 13, text: 'Immediate regret. -15 HP each.', effects: (ctx) => ctx.party.map(p => ({ kind: 'damage', target: p.userId, amount: 15, unblockable: true })) },
      ]},
      { label: 'Fill a bottle', emoji: '🍼', rollTable: [{ min: 1, max: 20, text: 'Stashed. +1 Curdle Bomb.', effects: (ctx) => [{ kind: 'grant_item', target: ctx.chooserId, item: 'curdle_bomb' }] }] },
      { label: 'Ignore', emoji: '🚫', rollTable: [{ min: 1, max: 20, text: 'Walked by.', effects: () => [] }] },
    ],
  },
  {
    key: 'phantom_cow',
    title: 'A Phantom Cow',
    description: "A translucent cow blocks the path. It moos judgmentally.",
    choices: [
      { label: 'Milk it', emoji: '🐄', rollTable: [
        { min: 13, max: 20, text: 'Ghostly milk heals all wounds.', effects: (ctx) => ctx.party.map(p => ({ kind: 'heal', target: p.userId, amount: 999 })) },
        { min: 1, max: 12, text: 'It kicks you. -20 HP.', effects: (ctx) => [{ kind: 'damage', target: ctx.chooserId, amount: 20, unblockable: true }] },
      ]},
      { label: 'Negotiate', emoji: '🤝', rollTable: [
        { min: 14, max: 20, text: 'It gifts a relic and vanishes.', effects: () => [{ kind: 'grant_relic' }] },
        { min: 1, max: 13, text: 'It ignores you and vanishes.', effects: () => [] },
      ]},
      { label: 'Push past', emoji: '🏃', rollTable: [{ min: 1, max: 20, text: 'Pushed through. Felt rude.', effects: () => [] }] },
    ],
  },
  {
    key: 'lost_traveler',
    title: 'A Lost Traveler',
    description: 'A dazed adventurer sits on a stone, clutching a map.',
    choices: [
      { label: 'Help them', emoji: '💝', rollTable: [
        { min: 13, max: 20, text: 'Grateful, they hand you a relic.', effects: () => [{ kind: 'grant_relic' }] },
        { min: 5, max: 12, text: 'They thank you and wander off.', effects: () => [] },
        { min: 1, max: 4, text: 'They were a trap. Combat!', effects: () => [{ kind: 'spawn_combat', enemies: ['skim_revenant'] }] },
      ]},
      { label: 'Rob them', emoji: '🗡️', rollTable: [
        { min: 12, max: 20, text: '+400 bucks to pot, +1 consumable.', effects: (ctx) => [{ kind: 'pot_add', amount: 400 }, { kind: 'grant_item', target: ctx.chooserId, item: 'random' }] },
        { min: 1, max: 11, text: 'They fight back! Combat.', effects: () => [{ kind: 'spawn_combat', enemies: ['whey_wraith', 'curdling'] }] },
      ]},
      { label: 'Walk past', emoji: '🚶', rollTable: [{ min: 1, max: 20, text: 'No interaction. No reward.', effects: () => [] }] },
    ],
  },
];

function getEvent(key) { return EVENTS.find(e => e.key === key); }
function pickRandomEvent(rng) { return EVENTS[rng.int(EVENTS.length)]; }

function resolveRoll(choice, roll) {
  return choice.rollTable.find(row => roll >= row.min && roll <= row.max) || choice.rollTable[choice.rollTable.length - 1];
}

module.exports = { EVENTS, getEvent, pickRandomEvent, resolveRoll };
