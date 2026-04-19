// Seeded RNG (mulberry32) — deterministic, reproducible, fast enough for game use.
// Reason: every run has a `seed`, and all random rolls (damage, drops, room choice) go through
// run.rng() so bugs can be reproduced from a seed alone, and the daily challenge uses the same
// seed for every player that day.

function mulberry32(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function newSeed() {
  return Math.floor(Math.random() * 0x100000000);
}

function daySeed(dateString) {
  return hashString('milkbot-dungeon-' + dateString);
}

function makeRunRng(seed) {
  const rng = mulberry32(seed);
  return {
    seed,
    next: rng,
    int: (maxExclusive) => Math.floor(rng() * maxExclusive),
    range: (min, maxInclusive) => min + Math.floor(rng() * (maxInclusive - min + 1)),
    chance: (prob) => rng() < prob,
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
    // Weighted pick from [{item, weight}, ...]
    weighted: (entries) => {
      const total = entries.reduce((s, e) => s + e.weight, 0);
      let roll = rng() * total;
      for (const e of entries) {
        roll -= e.weight;
        if (roll <= 0) return e.item;
      }
      return entries[entries.length - 1].item;
    },
  };
}

module.exports = { mulberry32, hashString, newSeed, daySeed, makeRunRng };
