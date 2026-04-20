// Lookup tables for dungeon-specific unlock logic.
// Centralizing here so adding a new dungeon is a data-only change — no more
// scattered if (run.dungeonId === 'udder_abyss') branches across dungeon.js.

// Dungeon access gates. If a gate is set, the user must have completed the
// named dungeon (via `completionsByDungeon`) before they can start this one.
const DUNGEON_UNLOCK_GATES = {
  spoiled_vault:     null,
  udder_abyss:       { requiresCompletion: 'spoiled_vault' },
  creamspire_cosmos: { requiresCompletion: 'udder_abyss' },
};

// Class unlocks earned by clearing a given floor in a given dungeon.
// Floor 5 = midboss clear. Floor 10 = run completion (applied in endRun).
const CLASS_UNLOCKS_ON_FLOOR_CLEAR = {
  spoiled_vault:     { 5: 'curd_medic',  10: 'lactic_mage' },
  udder_abyss:       { 5: 'frothmancer', 10: 'whey_warden' },
  creamspire_cosmos: { 5: 'cream_bard',  10: 'herder' },
};

// Back-compat: before per-dungeon completion tracking shipped, all completions
// rolled up into stats.completions. Treat a legacy count as Spoiled-Vault
// credit so the existing Abyss gate doesn't regress for established players.
function hasCompletedDungeon(stats, dungeonId) {
  if ((stats.completionsByDungeon?.[dungeonId] || 0) >= 1) return true;
  if (dungeonId === 'spoiled_vault' && (stats.completions || 0) >= 1) return true;
  return false;
}

function getGate(dungeonId) {
  return DUNGEON_UNLOCK_GATES[dungeonId] || null;
}

function classUnlockFor(dungeonId, floor) {
  return CLASS_UNLOCKS_ON_FLOOR_CLEAR[dungeonId]?.[floor] || null;
}

module.exports = {
  DUNGEON_UNLOCK_GATES,
  CLASS_UNLOCKS_ON_FLOOR_CLEAR,
  hasCompletedDungeon,
  getGate,
  classUnlockFor,
};
