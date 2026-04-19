const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');

const TRACKED_FILES = [
  'balances.json',
  'xp.json',
  'prestige.json',
  'stocks.json',
  'portfolios.json',
  'pricehistory.json',
  'raidboss.json',
  'achievements.json',
  'bigtrades.json',
  'lottery.json',
  'buffs.json',
  'inventory.json',
];

function ensureSnapshotDir() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
}

function estDateString(date = new Date()) {
  const estString = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [m, d, y] = estString.split('/');
  return `${y}-${m}-${d}`;
}

function readJson(filename) {
  const fullPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    console.error(`[snapshot] corrupted ${filename}:`, e.message);
    return null;
  }
}

function captureSnapshot(dateString = estDateString()) {
  ensureSnapshotDir();
  const snapshot = {
    date: dateString,
    capturedAt: new Date().toISOString(),
    data: {},
  };
  for (const file of TRACKED_FILES) {
    const key = file.replace('.json', '');
    const content = readJson(file);
    if (content !== null) snapshot.data[key] = content;
  }
  const outPath = path.join(SNAPSHOT_DIR, `${dateString}.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`[snapshot] saved ${dateString} (${Object.keys(snapshot.data).length} files)`);
  return snapshot;
}

function loadSnapshot(dateString) {
  const fullPath = path.join(SNAPSHOT_DIR, `${dateString}.json`);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    console.error(`[snapshot] corrupted ${dateString}.json:`, e.message);
    return null;
  }
}

function yesterdayDateString(reference = new Date()) {
  const yesterday = new Date(reference.getTime() - 24 * 60 * 60 * 1000);
  return estDateString(yesterday);
}

function loadLatestPair() {
  const today = estDateString();
  const yesterday = yesterdayDateString();
  return {
    today: loadSnapshot(today),
    yesterday: loadSnapshot(yesterday),
    todayDate: today,
    yesterdayDate: yesterday,
  };
}

function pruneOldSnapshots(keepDays = 30) {
  ensureSnapshotDir();
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json'));
  let removed = 0;
  for (const file of files) {
    const fullPath = path.join(SNAPSHOT_DIR, file);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fullPath);
      removed++;
    }
  }
  if (removed > 0) console.log(`[snapshot] pruned ${removed} old snapshot(s)`);
}

module.exports = {
  captureSnapshot,
  loadSnapshot,
  loadLatestPair,
  estDateString,
  yesterdayDateString,
  pruneOldSnapshots,
  TRACKED_FILES,
};
