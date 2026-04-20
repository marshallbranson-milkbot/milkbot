// Dungeon run state: in-memory Map of active runs, atomic JSON persistence with debounced writes.
// Pattern: mutate in-memory → mark run.dirty → single setTimeout flushes all dirty runs.
// Atomic write (tmp + rename) prevents corruption if the process dies mid-write.

const fs = require('fs');
const path = require('path');
const { makeRunRng, newSeed } = require('./rng');
const { defaultUnlockedKeys } = require('./classes');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ACTIVE_PATH = path.join(DATA_DIR, 'dungeon-active.json');
const STATS_PATH = path.join(DATA_DIR, 'dungeon-stats.json');
const DAILY_PATH = path.join(DATA_DIR, 'dungeon-daily.json');

const FLUSH_DEBOUNCE_MS = 250;

// In-memory active runs keyed by runId
const activeRuns = new Map();
let flushTimer = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function atomicWrite(filePath, obj) {
  ensureDataDir();
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, filePath);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`[dungeon] corrupted ${path.basename(filePath)}:`, e.message);
    return fallback;
  }
}

// Convert a run to a serializable form. The RNG function is recreated on load from run.seed.
// Strip anything transient: the RNG closure, timers, discord.js object references, and every
// underscore-prefixed field (by convention, those are in-memory-only run state).
function serializeRun(run) {
  const copy = {};
  for (const key of Object.keys(run)) {
    if (key === 'rng' || key === 'dirty' || key === 'channel' || key === 'thread' || key === 'message') continue;
    if (key.startsWith('_')) continue;
    copy[key] = run[key];
  }
  return copy;
}

function flushActiveRunsNow() {
  const snapshot = {};
  for (const [runId, run] of activeRuns) {
    snapshot[runId] = serializeRun(run);
  }
  try {
    atomicWrite(ACTIVE_PATH, snapshot);
  } catch (e) {
    console.error('[dungeon] flush failed:', e.message);
  }
  for (const run of activeRuns.values()) run.dirty = false;
}

function markDirty(run) {
  run.dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushActiveRunsNow();
  }, FLUSH_DEBOUNCE_MS);
}

function newRunId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function createRun({ creatorId, creatorName, guildId, channelId, maxPartySize = 4, difficulty = 'normal', seed = null, dungeonId = 'spoiled_vault' }) {
  const runId = newRunId();
  const actualSeed = seed ?? newSeed();
  const run = {
    runId,
    state: 'LOBBY',               // LOBBY -> CLASS_PICK -> PLAYING -> ENDED
    createdAt: Date.now(),
    updatedAt: Date.now(),
    seed: actualSeed,
    guildId,
    channelId,
    threadId: null,
    statusMessageId: null,        // top-of-thread status embed
    creatorId,
    creatorName,
    maxPartySize,
    difficulty,
    dungeonId,
    party: [],                    // [{ userId, username, classKey, hp, maxHp, statuses: [], cooldowns: {}, items: [] }]
    floor: 1,
    currentRoom: null,            // { kind, enemies?, chest?, eventId?, resolved? }
    relics: [],                   // shared party relics (keys)
    pot: 0,                       // milk bucks pooled
    log: [],                      // recent combat log lines
    turnIndex: 0,                 // index into turn order for combat
    turnOrder: [],                // list of { kind: 'player'|'enemy', id } in initiative order
    currentTurn: null,            // { kind, id, startedAt, warnings }
    dailyChallengeDate: null,     // 'YYYY-MM-DD' when this is a daily seeded run
  };
  run.rng = makeRunRng(actualSeed);
  activeRuns.set(runId, run);
  markDirty(run);
  return run;
}

function getRun(runId) {
  return activeRuns.get(runId);
}

function allRuns() {
  return [...activeRuns.values()];
}

function deleteRun(runId) {
  activeRuns.delete(runId);
  markDirty({});  // force flush
}

// Repair any non-finite HP values on a restored run. JSON turns NaN into null,
// and the Milkmaid Ghost unblockable-damage bug could leave hp as NaN in-memory
// before flush. Either way, non-finite = reset to full so players can continue.
function repairCorruptHp(run) {
  let repaired = 0;
  for (const p of run.party || []) {
    if (!Number.isFinite(p.hp) || !Number.isFinite(p.maxHp) || p.maxHp <= 0) {
      p.maxHp = Number.isFinite(p.maxHp) && p.maxHp > 0 ? p.maxHp : 100;
      p.hp = p.maxHp;
      p.downed = false;
      repaired++;
    }
    // Cooldowns stuck as NaN or absurd values from corrupted state would grey
    // out ability buttons forever — normalize on restore.
    if (p.cooldowns && typeof p.cooldowns === 'object') {
      for (const key of Object.keys(p.cooldowns)) {
        const v = p.cooldowns[key];
        if (!Number.isFinite(v) || v < 0 || v > 20) {
          p.cooldowns[key] = 0;
          repaired++;
        }
      }
    } else {
      p.cooldowns = {};
    }
  }
  for (const e of run.currentRoom?.enemies || []) {
    if (!Number.isFinite(e.hp) || !Number.isFinite(e.maxHp) || e.maxHp <= 0) {
      e.maxHp = Number.isFinite(e.maxHp) && e.maxHp > 0 ? e.maxHp : 50;
      e.hp = e.maxHp;
      repaired++;
    }
  }
  if (repaired) console.log(`[dungeon] repaired ${repaired} corrupt values in run ${run.runId}`);
  return repaired > 0;
}

function restoreActiveRuns() {
  const snapshot = readJson(ACTIVE_PATH, {});
  for (const [runId, data] of Object.entries(snapshot)) {
    const run = { ...data };
    run.rng = makeRunRng(run.seed);
    run.dirty = false;
    if (repairCorruptHp(run)) run.dirty = true;
    activeRuns.set(runId, run);
  }
  if (flushTimer === null && [...activeRuns.values()].some(r => r.dirty)) {
    flushTimer = setTimeout(() => { flushTimer = null; flushActiveRunsNow(); }, FLUSH_DEBOUNCE_MS);
  }
  console.log(`[dungeon] restored ${activeRuns.size} active run(s)`);
  return [...activeRuns.values()];
}

// One-shot migration: for users who completed dungeons before the unlock
// wiring was correct, backfill their classUnlocks from completionsByDungeon
// (or from the legacy "completions" counter, which we attribute to Spoiled
// Vault since that was the only dungeon when the counter shipped).
function backfillClassUnlocks() {
  let UNLOCK_TABLE;
  try { ({ CLASS_UNLOCKS_ON_FLOOR_CLEAR: UNLOCK_TABLE } = require('./unlocks')); }
  catch { return { checked: 0, updated: 0 }; }
  const stats = readStats();
  let updated = 0;
  let checked = 0;
  for (const userId of Object.keys(stats)) {
    checked++;
    const s = stats[userId];
    if (!Array.isArray(s.classUnlocks)) s.classUnlocks = [];
    const cbd = s.completionsByDungeon || {};
    const dungeonsToCredit = new Set(Object.keys(cbd).filter(k => cbd[k] >= 1));
    // Legacy users with just `completions >= 1` are credited to Spoiled Vault.
    if (dungeonsToCredit.size === 0 && (s.completions || 0) >= 1) {
      dungeonsToCredit.add('spoiled_vault');
    }
    let changed = false;
    for (const did of dungeonsToCredit) {
      const unlocks = UNLOCK_TABLE[did];
      if (!unlocks) continue;
      for (const floor of [5, 10]) {
        const key = unlocks[floor];
        if (!key) continue;
        if (!s.classUnlocks.includes(key)) {
          s.classUnlocks.push(key);
          changed = true;
        }
      }
    }
    if (changed) updated++;
  }
  if (updated > 0) writeStats(stats);
  console.log(`[dungeon] class-unlock backfill: ${updated}/${checked} users updated`);
  return { checked, updated };
}

// === Stats ===

function readStats() {
  return readJson(STATS_PATH, {});
}

function writeStats(stats) {
  atomicWrite(STATS_PATH, stats);
}

function getUserStats(userId) {
  const stats = readStats();
  if (!stats[userId]) {
    stats[userId] = {
      totalRuns: 0,
      completions: 0,
      deepestFloor: 0,
      fastestRunMs: null,
      favClass: null,
      classUnlocks: defaultUnlockedKeys(),
      relicsSeen: [],
      last10Runs: [],
      achievementsEarned: [],
      abilityUnlocks: [],
      completionsByDungeon: {},
    };
    writeStats(stats);
  }
  if (!stats[userId].abilityUnlocks) stats[userId].abilityUnlocks = [];
  if (!stats[userId].completionsByDungeon) stats[userId].completionsByDungeon = {};
  return stats[userId];
}

function updateUserStats(userId, mutator) {
  const stats = readStats();
  if (!stats[userId]) {
    stats[userId] = {
      totalRuns: 0,
      completions: 0,
      deepestFloor: 0,
      fastestRunMs: null,
      favClass: null,
      classUnlocks: defaultUnlockedKeys(),
      relicsSeen: [],
      last10Runs: [],
      achievementsEarned: [],
      abilityUnlocks: [],
      completionsByDungeon: {},
    };
  }
  if (!stats[userId].abilityUnlocks) stats[userId].abilityUnlocks = [];
  if (!stats[userId].completionsByDungeon) stats[userId].completionsByDungeon = {};
  mutator(stats[userId]);
  writeStats(stats);
  return stats[userId];
}

// === Daily ===

function readDaily() {
  return readJson(DAILY_PATH, {});
}

function writeDaily(daily) {
  atomicWrite(DAILY_PATH, daily);
}

// Force-flush on process exit to prevent mid-run data loss
function installShutdownHooks() {
  const flush = () => {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flushActiveRunsNow();
  };
  process.once('beforeExit', flush);
  process.once('SIGTERM', flush);
}

module.exports = {
  // Lifecycle
  createRun,
  getRun,
  allRuns,
  deleteRun,
  restoreActiveRuns,
  markDirty,
  flushActiveRunsNow,
  installShutdownHooks,
  backfillClassUnlocks,
  // Stats
  getUserStats,
  updateUserStats,
  readStats,
  writeStats,
  // Daily
  readDaily,
  writeDaily,
  // Paths (for debugging)
  ACTIVE_PATH,
  STATS_PATH,
  DAILY_PATH,
};
