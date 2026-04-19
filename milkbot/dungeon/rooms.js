// Room generator — picks the next room based on floor and random roll.
// Slice 1: combat rooms only. Slice 2 will expand to treasure/event/merchant/rest/elite.

const { listEnemies, enemiesByTier } = require('./enemies');

// Enemy pools by floor range
function enemyPoolForFloor(floor) {
  if (floor <= 3) return enemiesByTier(1).concat(enemiesByTier(2).slice(0, 1));
  if (floor <= 6) return enemiesByTier(2).concat(enemiesByTier(3).slice(0, 1));
  return enemiesByTier(2).concat(enemiesByTier(3));
}

function pickEnemyCountForFloor(floor, partySize, rng) {
  // Roughly half party size, + occasional extra on higher floors.
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
  return { kind: 'combat', enemyKeys };
}

function generateRoom(run) {
  // Slice 1: combat only. Later slices weight kinds.
  return generateCombatRoom(run);
}

module.exports = { generateRoom, generateCombatRoom, enemyPoolForFloor };
