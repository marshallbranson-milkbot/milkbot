// Full-game simulation harness — simulates a 4-player run end-to-end through ALL systems
// (lobby → class pick → combat → events → treasure → merchant → rest → bosses → run end).
// No Discord dependency. Prints a transcript. Used for integration testing.
//
// Usage: node dungeon/playsim.js [seed]

const { listClasses, getClass } = require('./classes');
const { ENEMIES, getEnemy } = require('./enemies');
const { startCombat, isCombatOver, currentActor, advanceTurn, processEffects, playerAttack, playerDefend, playerAbility, enemyTurn, initPlayer } = require('./combat');
const { generateRoom, generateCombatRoom } = require('./rooms');
const { pickRandomEvent, resolveRoll } = require('./events');
const { listConsumables, listRelics, getConsumable, getRelic, rollConsumableDrop, rollRelicDrop } = require('./loot');
const { makeRunRng, newSeed } = require('./rng');

const FINAL_FLOOR = 10;
const MAX_TURNS_PER_COMBAT = 300;

function log(...args) { console.log(...args); }

function makeRun(seed, partySize = 4) {
  const rng = makeRunRng(seed);
  const classKeys = listClasses().filter(c => c.unlockedByDefault).map(c => c.key);
  const allKeys = listClasses().map(c => c.key);
  const usable = classKeys.length >= partySize ? classKeys : allKeys;
  const usernames = ['Moorshall', 'Beej', 'Cass', 'Grinder'];
  const party = Array.from({ length: partySize }, (_, i) =>
    initPlayer({ userId: `u${i}`, username: usernames[i] || `P${i+1}`, classKey: usable[i % usable.length] })
  );
  return {
    runId: 'sim-' + seed,
    state: 'PLAYING',
    seed,
    rng,
    party,
    floor: 1,
    relics: [],
    pot: 1000 * partySize,
    log: [],
    currentRoom: null,
    turnOrder: [],
    turnIndex: 0,
    difficulty: 'normal',
    maxPartySize: partySize,
    createdAt: Date.now(),
  };
}

// Player AI — tries to play smart per class
function pickPlayerAction(run, player) {
  const cls = getClass(player.classKey);

  // Use healing potion if HP < 30%
  if (player.hp / player.maxHp < 0.30 && player.items.includes('healing_milk_potion')) {
    return { kind: 'item', itemKey: 'healing_milk_potion' };
  }

  // Medic: revive, heal, then attack
  if (cls.key === 'curd_medic') {
    const downed = run.party.find(p => p.downed);
    if (downed && !player.cooldowns['revive']) {
      return { kind: 'ability', abilityKey: 'revive', targetId: downed.userId };
    }
    const wounded = run.party.filter(p => !p.downed && p.hp < p.maxHp * 0.5)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    if (wounded && !player.cooldowns['milk_transfusion']) {
      return { kind: 'ability', abilityKey: 'milk_transfusion', targetId: wounded.userId };
    }
    return { kind: 'attack' };
  }

  // Creamlord: taunt when party hurt, else attack
  if (cls.key === 'creamlord') {
    const partyWounded = run.party.filter(p => !p.downed && p.hp < p.maxHp * 0.4).length;
    if (partyWounded > 0 && !player.cooldowns['taunt']) {
      return { kind: 'ability', abilityKey: 'taunt' };
    }
    return { kind: 'attack' };
  }

  // Others: use ability 1 if off cooldown
  const a1 = cls.abilities[0];
  if (!player.cooldowns[a1.key]) {
    let targetId;
    if (a1.targetKind === 'enemy') {
      const t = run.currentRoom.enemies.find(e => e.hp > 0);
      targetId = t?.id;
    } else if (a1.targetKind === 'ally') {
      targetId = player.userId;
    }
    return { kind: 'ability', abilityKey: a1.key, targetId };
  }
  return { kind: 'attack' };
}

function simulateCombat(run) {
  log(`\n  ⚔️  combat begins`);
  let turns = 0;
  while (turns++ < MAX_TURNS_PER_COMBAT) {
    const end = isCombatOver(run);
    if (end.over) {
      log(`  ${end.victory ? '✅ victory' : '💀 wipe'} after ${turns} turns`);
      return end;
    }
    const actor = currentActor(run);
    if (!actor) break;
    if (actor.kind === 'player') {
      if (actor.entity.downed) { advanceTurn(run); continue; }
      const action = pickPlayerAction(run, actor.entity);
      let effects = [];
      let name = 'attack';
      if (action.kind === 'attack') {
        effects = playerAttack(run, actor.entity);
        name = 'attack';
      } else if (action.kind === 'defend') {
        playerDefend(run, actor.entity);
        name = 'defend';
      } else if (action.kind === 'ability') {
        const r = playerAbility(run, actor.entity, action.abilityKey, action.targetId);
        if (!r.error) { effects = r.effects; name = r.abilityName; }
      } else if (action.kind === 'item') {
        const c = getConsumable(action.itemKey);
        const ctx = { userId: actor.entity.userId, targetId: actor.entity.userId, party: run.party, enemies: run.currentRoom.enemies };
        effects = c.use(ctx);
        const idx = actor.entity.items.indexOf(action.itemKey);
        if (idx >= 0) actor.entity.items.splice(idx, 1);
        name = `${c.name} (item)`;
      }
      const logs = processEffects(run, effects, `${actor.entity.username} [${name}]`, run.rng);
      for (const l of logs.slice(0, 2)) log(`    • ${l}`);
      advanceTurn(run);
    } else {
      const res = enemyTurn(run, actor.entity);
      if (res.skipped) {
        log(`    • ${res.logs[0]}`);
      } else {
        const logs = processEffects(run, res.effects || [], actor.entity.name, run.rng);
        for (const l of logs.slice(0, 2)) log(`    • ${l}`);
      }
      advanceTurn(run);
    }
  }
  return { over: true, victory: false, timedOut: true };
}

function simulateEvent(run, event) {
  log(`\n  📜 event: ${event.title}`);
  // AI: pick choice 1 (usually the "safe" option is later, but index 0 is often most interesting)
  const choice = event.choices[0];
  const roll = 1 + run.rng.int(20);
  const outcome = resolveRoll(choice, roll);
  log(`    → "${choice.label}" — rolled ${roll} — ${outcome.text}`);
  const ctx = { chooserId: run.party[0].userId, party: run.party };
  const effects = outcome.effects(ctx) || [];
  for (const eff of effects) {
    if (eff.kind === 'grant_relic') {
      const r = rollRelicDrop(run.rng, eff.rarityBias || 1);
      if (!run.relics.includes(r.key)) { run.relics.push(r.key); log(`    🏺 ${r.name}`); }
    } else if (eff.kind === 'grant_item') {
      const target = run.party.find(p => p.userId === eff.target) || run.party[0];
      const item = eff.item === 'random' ? rollConsumableDrop(run.rng) : getConsumable(eff.item);
      if (item && target) { target.items.push(item.key); log(`    🎒 ${target.username} got ${item.name}`); }
    } else if (eff.kind === 'pot_add') { run.pot += eff.amount; log(`    💰 +${eff.amount}`); }
    else if (eff.kind === 'pot_sub') { run.pot = Math.max(0, run.pot - eff.amount); log(`    💸 -${eff.amount}`); }
    else if (eff.kind === 'spawn_combat') {
      log(`    ⚔️  event combat:`);
      startCombat(run, eff.enemies);
      simulateCombat(run);
    } else {
      processEffects(run, [eff], 'event', run.rng);
    }
  }
}

function simulateTreasure(run) {
  log(`\n  💰 treasure room`);
  // Each player picks an unclaimed chest
  for (let i = 0; i < Math.min(run.party.length, run.currentRoom.chests.length); i++) {
    const player = run.party[i];
    const chest = run.currentRoom.chests[i];
    if (chest.kind === 'relic') {
      if (!run.relics.includes(chest.item.key)) { run.relics.push(chest.item.key); log(`    ${player.username} → 🏺 ${chest.item.name}`); }
    } else {
      player.items.push(chest.item.key);
      log(`    ${player.username} → 🎒 ${chest.item.name}`);
    }
  }
}

function simulateMerchant(run) {
  log(`\n  🛒 merchant — pot ${run.pot}`);
  // Buy 1 healing potion if affordable
  for (let i = 0; i < run.currentRoom.items.length; i++) {
    const slot = run.currentRoom.items[i];
    if (slot.item.key === 'healing_milk_potion' && run.pot >= slot.price && !run.currentRoom.purchased[i]) {
      run.pot -= slot.price;
      run.currentRoom.purchased[i] = run.party[0].userId;
      run.party[0].items.push(slot.item.key);
      log(`    bought ${slot.item.name} (${slot.price})`);
      break;
    }
  }
}

function simulateRest(run) {
  log(`\n  🏕️  rest — heal 40 HP`);
  for (const p of run.party) {
    if (!p.downed) p.hp = Math.min(p.maxHp, p.hp + 40);
  }
}

function simulateRoom(run) {
  const room = generateRoom(run);
  run.currentRoom = room;
  log(`\n━━━ FLOOR ${run.floor} · ${room.kind.toUpperCase()} ━━━`);

  if (room.kind === 'combat' || room.kind === 'elite' || room.kind === 'boss') {
    startCombat(run, room.enemyKeys);
    return simulateCombat(run);
  }
  if (room.kind === 'treasure') { simulateTreasure(run); return { over: true, victory: true }; }
  if (room.kind === 'event') {
    const ev = require('./events').getEvent(room.eventKey);
    simulateEvent(run, ev);
    return { over: true, victory: true };
  }
  if (room.kind === 'merchant') { simulateMerchant(run); return { over: true, victory: true }; }
  if (room.kind === 'rest') { simulateRest(run); return { over: true, victory: true }; }
  return { over: true, victory: true };
}

function printPartyStatus(run) {
  log(`\n  PARTY:`);
  for (const p of run.party) {
    const bar = '▰'.repeat(Math.round((p.hp / p.maxHp) * 10)) + '▱'.repeat(10 - Math.round((p.hp / p.maxHp) * 10));
    const status = p.downed ? '💀 curdled' : `${p.hp}/${p.maxHp}`;
    const items = p.items.length ? ` items:${p.items.length}` : '';
    log(`    ${getClass(p.classKey).emoji} ${p.username.padEnd(10)} ${bar} ${status}${items}`);
  }
  log(`  Pot: ${run.pot} 🥛  Relics: ${run.relics.length}  [${run.relics.join(', ')}]`);
}

function runFullSim(seed, partySize = 4) {
  log(`\n╔════════════════════════════════════╗`);
  log(`║  MILKBOT DUNGEON — FULL SIM RUN    ║`);
  log(`║  seed: ${String(seed).padEnd(28)}║`);
  log(`║  party size: ${String(partySize).padEnd(22)}║`);
  log(`╚════════════════════════════════════╝`);

  const run = makeRun(seed, partySize);
  log(`\nPARTY:`);
  for (const p of run.party) {
    log(`  ${getClass(p.classKey).emoji} ${p.username} — ${getClass(p.classKey).name}`);
  }

  let floor = 1;
  while (floor <= FINAL_FLOOR) {
    run.floor = floor;
    // Auto-revive between floors
    for (const p of run.party) {
      if (p.downed) { p.downed = false; p.hp = Math.floor(p.maxHp * 0.5); }
    }
    const result = simulateRoom(run);
    printPartyStatus(run);

    if (result && result.over === true && result.victory === false) {
      log(`\n💀 PARTY WIPED on floor ${floor}`);
      return { floorsCleared: floor - 1, completed: false };
    }
    floor += 1;
  }
  log(`\n🏆 VICTORY — all 10 floors cleared`);
  return { floorsCleared: FINAL_FLOOR, completed: true };
}

if (require.main === module) {
  const seed = Number(process.argv[2]) || newSeed();
  const partySize = Number(process.argv[3]) || 4;
  const result = runFullSim(seed, partySize);
  log(`\nResult:`, result);
}

module.exports = { runFullSim };
