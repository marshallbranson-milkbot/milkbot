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

function createRun({ creatorId, creatorName, guildId, channelId, maxPartySize = 4, difficulty = 'normal', seed = null }) {
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

function restoreActiveRuns() {
  const snapshot = readJson(ACTIVE_PATH, {});
  for (const [runId, data] of Object.entries(snapshot)) {
    const run = { ...data };
    run.rng = makeRunRng(run.seed);
    run.dirty = false;
    activeRuns.set(runId, run);
  }
  console.log(`[dungeon] restored ${activeRuns.size} active run(s)`);
  return [...activeRuns.values()];
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
    };
    writeStats(stats);
  }
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
    };
  }
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
