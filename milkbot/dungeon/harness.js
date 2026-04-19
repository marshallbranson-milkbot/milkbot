// Offline simulation harness — runs N battles with a configurable party against generated rooms.
// Usage: node dungeon/harness.js [numRuns=500] [partySize=4]
// Prints win rate per class, avg floor reached, avg HP lost. No Discord dependency.

const { listClasses, getClass } = require('./classes');
const { initPlayer, startCombat, isCombatOver, currentActor, advanceTurn, processEffects, playerAttack, playerAbility, enemyTurn } = require('./combat');
const { generateRoom } = require('./rooms');
const { makeRunRng, newSeed } = require('./rng');

const MAX_TURNS_PER_COMBAT = 200;

function makeFakeRun({ partyKeys, seed }) {
  const rng = makeRunRng(seed);
  const party = partyKeys.map((classKey, idx) =>
    initPlayer({ userId: `u${idx}`, username: `Player${idx + 1}`, classKey })
  );
  return {
    runId: 'sim-' + seed,
    state: 'PLAYING',
    seed,
    rng,
    party,
    floor: 1,
    relics: [],
    pot: 0,
    log: [],
    currentRoom: null,
    turnOrder: [],
    turnIndex: 0,
    difficulty: 'normal',
    maxPartySize: partyKeys.length,
  };
}

// Very simple AI for simulated players: attack if no ability ready, otherwise use ability 1
function pickPlayerAction(run, player) {
  const cls = getClass(player.classKey);
  if (!cls) return { kind: 'attack' };
  // Medic: prioritize revive then heal
  if (cls.key === 'curd_medic') {
    const downedAlly = run.party.find(p => p.downed);
    if (downedAlly && !player.cooldowns['revive']) {
      return { kind: 'ability', abilityKey: 'revive', targetId: downedAlly.userId };
    }
    const wounded = run.party.filter(p => !p.downed && p.hp < p.maxHp * 0.5).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    if (wounded && !player.cooldowns['milk_transfusion']) {
      return { kind: 'ability', abilityKey: 'milk_transfusion', targetId: wounded.userId };
    }
    return { kind: 'attack' };
  }
  // Others: use ability 1 if off cooldown
  const ability1 = cls.abilities[0];
  if (!player.cooldowns[ability1.key]) {
    let targetId;
    if (ability1.targetKind === 'enemy') {
      const target = run.currentRoom.enemies.find(e => e.hp > 0);
      targetId = target?.id;
    } else if (ability1.targetKind === 'ally') {
      targetId = player.userId;
    }
    return { kind: 'ability', abilityKey: ability1.key, targetId };
  }
  return { kind: 'attack' };
}

function simulateOneCombat(run) {
  const room = generateRoom(run);
  startCombat(run, room.enemyKeys);
  let turns = 0;
  while (turns++ < MAX_TURNS_PER_COMBAT) {
    const end = isCombatOver(run);
    if (end.over) return { victory: end.victory, turns, fled: !!end.fled };
    const actor = currentActor(run);
    if (!actor) break;
    if (actor.kind === 'player') {
      if (actor.entity.downed) { advanceTurn(run); continue; }
      const action = pickPlayerAction(run, actor.entity);
      let effects = [];
      if (action.kind === 'attack') effects = playerAttack(run, actor.entity);
      else if (action.kind === 'ability') {
        const r = playerAbility(run, actor.entity, action.abilityKey, action.targetId);
        if (!r.error) effects = r.effects;
      }
      processEffects(run, effects, actor.entity.username, run.rng);
      advanceTurn(run);
    } else {
      const res = enemyTurn(run, actor.entity);
      if (!res.skipped) processEffects(run, res.effects || [], actor.entity.name, run.rng);
      advanceTurn(run);
    }
  }
  return { victory: false, turns, timedOut: true };
}

function simulateRun({ partyKeys, seed, maxFloor = 10 }) {
  const run = makeFakeRun({ partyKeys, seed });
  let floor = 1;
  let totalTurns = 0;
  while (floor <= maxFloor) {
    run.floor = floor;
    // Auto-revive downed between floors
    for (const p of run.party) {
      if (p.downed) { p.downed = false; p.hp = Math.floor(p.maxHp * 0.5); }
    }
    const result = simulateOneCombat(run);
    totalTurns += result.turns;
    if (!result.victory) return { floorsCleared: floor - 1, turns: totalTurns, partyFinalHp: run.party.map(p => p.hp) };
    floor += 1;
  }
  return { floorsCleared: maxFloor, turns: totalTurns, partyFinalHp: run.party.map(p => p.hp), completed: true };
}

function main() {
  const numRuns = Number(process.argv[2]) || 500;
  const partySize = Number(process.argv[3]) || 4;

  const classKeys = listClasses().filter(c => c.unlockedByDefault).map(c => c.key);
  // Fallback: include all classes if not enough unlocked
  const allKeys = listClasses().map(c => c.key);
  const usableKeys = classKeys.length >= partySize ? classKeys : allKeys;

  const results = [];
  for (let i = 0; i < numRuns; i++) {
    const partyKeys = [];
    for (let j = 0; j < partySize; j++) partyKeys.push(usableKeys[(i + j) % usableKeys.length]);
    const r = simulateRun({ partyKeys, seed: newSeed() });
    results.push({ partyKeys, ...r });
  }

  const completions = results.filter(r => r.completed).length;
  const avgFloor = results.reduce((s, r) => s + r.floorsCleared, 0) / results.length;
  const avgTurns = results.reduce((s, r) => s + r.turns, 0) / results.length;

  console.log(`\n=== Simulation: ${numRuns} runs, party size ${partySize} ===`);
  console.log(`Completions: ${completions}/${numRuns} (${((completions / numRuns) * 100).toFixed(1)}%)`);
  console.log(`Avg floor cleared: ${avgFloor.toFixed(2)} / 10`);
  console.log(`Avg turns/run: ${avgTurns.toFixed(1)}`);

  // Breakdown by floor reached
  const floorCounts = {};
  for (const r of results) {
    const k = r.floorsCleared;
    floorCounts[k] = (floorCounts[k] || 0) + 1;
  }
  console.log('\nFloor-reached histogram:');
  for (let f = 0; f <= 10; f++) {
    const count = floorCounts[f] || 0;
    const bar = '█'.repeat(Math.round((count / numRuns) * 40));
    console.log(`  ${String(f).padStart(2, ' ')}: ${bar} ${count}`);
  }
}

if (require.main === module) main();

module.exports = { simulateRun, simulateOneCombat };
