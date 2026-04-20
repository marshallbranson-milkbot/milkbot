// Room generator — picks the next room based on floor and weighted random roll.
// Room kinds: combat, elite, treasure, event, merchant, rest.

const { enemiesByTier } = require('./enemies');
const { pickRandomEvent } = require('./events');
const { rollConsumableDrop, rollRelicDrop, listConsumables } = require('./loot');
const { getBossForFloor } = require('./bosses');

// Enemy pools by floor range
function enemyPoolForFloor(floor) {
  if (floor <= 3) return enemiesByTier(1).concat(enemiesByTier(2).slice(0, 1));
  if (floor <= 6) return enemiesByTier(2).concat(enemiesByTier(3).slice(0, 1));
  return enemiesByTier(2).concat(enemiesByTier(3));
}

function pickEnemyCountForFloor(floor, partySize, rng) {
  // Solo gets 1 enemy at a time (rarely 2); pairs get 1-2; 3-4 players get 2-3.
  if (partySize === 1) return floor >= 6 ? (rng.chance(0.4) ? 2 : 1) : 1;
  const base = Math.max(1, Math.ceil(partySize * 0.5));
  const bonus = floor >= 5 ? rng.int(2) : 0;
  return Math.min(4, base + bonus);
}

function generateCombatRoom(run) {
  const pool = enemyPoolForFloor(run.floor);
  const count = pickEnemyCountForFloor(run.floor, run.party.length, run.rng);
  const enemyKeys = [];
  for (let i = 0; i < count; i++) {
    enemyKeys.push(run.rng.pick(pool).key);
  }
  return { kind: 'combat', enemyKeys, guaranteesLoot: run.rng.chance(0.35) };
}

function generateEliteRoom(run) {
  // One strong enemy (tier 3 where available) with guaranteed relic drop
  const pool = run.floor >= 4 ? enemiesByTier(3) : enemiesByTier(2);
  const key = run.rng.pick(pool).key;
  return { kind: 'elite', enemyKeys: [key], guaranteesRelic: true };
}

function generateTreasureRoom(run) {
  const chests = [];
  for (let i = 0; i < 3; i++) {
    // Each chest is either a consumable or (rarely) a relic
    if (run.rng.chance(0.25)) {
      chests.push({ kind: 'relic', item: rollRelicDrop(run.rng) });
    } else {
      chests.push({ kind: 'consumable', item: rollConsumableDrop(run.rng) });
    }
  }
  return { kind: 'treasure', chests, claimed: {} };  // claimed: { userId: chestIndex }
}

function generateEventRoom(run) {
  const event = pickRandomEvent(run.rng);
  return { kind: 'event', eventKey: event.key, resolved: false };
}

function generateMerchantRoom(run) {
  const items = [];
  const pool = listConsumables();
  const used = new Set();
  while (items.length < 5 && items.length < pool.length) {
    const pick = run.rng.pick(pool);
    if (used.has(pick.key)) continue;
    used.add(pick.key);
    const basePrice = pick.rarity === 'common' ? 200 : pick.rarity === 'uncommon' ? 400 : 700;
    items.push({ item: pick, price: basePrice });
  }
  return { kind: 'merchant', items, purchased: {} };
}

function generateRestRoom(run) {
  return { kind: 'rest', used: false };
}

function generateBossRoom(run) {
  const boss = getBossForFloor(run.floor);
  if (!boss) return null;
  return { kind: 'boss', enemyKeys: [boss.key], guaranteesRelic: true, guaranteesLoot: true };
}

// Weighted room picker
function generateRoom(run) {
  // Boss floors always spawn the boss for that floor
  const bossRoom = generateBossRoom(run);
  if (bossRoom) return bossRoom;

  const rng = run.rng;
  const roll = rng.next();
  // Combat 60% / elite 10% / treasure 8% / event 10% / merchant 7% / rest 5%
  if (roll < 0.60) return generateCombatRoom(run);
  if (roll < 0.70) return generateEliteRoom(run);
  if (roll < 0.78) return generateTreasureRoom(run);
  if (roll < 0.88) return generateEventRoom(run);
  if (roll < 0.95) return generateMerchantRoom(run);
  return generateRestRoom(run);
}

module.exports = {
  generateRoom,
  generateCombatRoom,
  generateEliteRoom,
  generateTreasureRoom,
  generateEventRoom,
  generateMerchantRoom,
  generateRestRoom,
  generateBossRoom,
  enemyPoolForFloor,
};
