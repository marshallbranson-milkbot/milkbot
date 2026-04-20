// Combat engine — turn-based, initiative-driven.
// The run object carries all combat state; this module mutates run.party / run.currentRoom.enemies.

const { getEnemy } = require('./enemies');
const { getBoss } = require('./bosses');
const { getClass } = require('./classes');
const { getRelic } = require('./loot');

function getEnemyOrBoss(key) { return getBoss(key) || getEnemy(key); }

const BASE_CRIT_CHANCE = 0.15;
const CRIT_MULTIPLIER = 2;
const DAMAGE_VARIANCE = 0.2;         // ±20%
const SOUR_TICK_DAMAGE_DEFAULT = 5;

// Floor-scaled stats: gentler scaling so a 4-player party can complete runs regularly.
// Difficulty modifier: brutal = +25% to enemy stats.
function scaleEnemyStats(enemyDef, floor, difficulty = 'normal') {
  const hpMul = 1 + 0.08 * (floor - 1);
  const atkMul = 1 + 0.06 * (floor - 1);
  // Hardcore: +25% HP AND damage. 'brutal' legacy alias still works.
  const difficultyMul = (difficulty === 'brutal' || difficulty === 'hardcore') ? 1.25 : 1.0;
  return {
    hp: Math.floor(enemyDef.base.hp * hpMul * difficultyMul),
    maxHp: Math.floor(enemyDef.base.hp * hpMul * difficultyMul),
    atk: Math.floor(enemyDef.base.atk * atkMul * difficultyMul),
    def: enemyDef.base.def,
    spd: enemyDef.base.spd,
  };
}

// Initialize a player for a new run
function initPlayer({ userId, username, classKey }) {
  const cls = getClass(classKey);
  if (!cls) throw new Error(`Unknown class: ${classKey}`);
  return {
    userId,
    username,
    classKey,
    hp: cls.base.hp,
    maxHp: cls.base.hp,
    atk: cls.base.atk,
    def: cls.base.def,
    spd: cls.base.spd,
    statuses: [],           // [{ key, duration, meta? }]
    cooldowns: {},          // { abilityKey: turnsRemaining }
    items: [],              // [consumableKey]
    buffs: [],              // [{ stat, amount, duration }]
    downed: false,
    defending: false,
  };
}

// Spawn enemies for a combat room (bosses included). Bosses scale down for small parties.
function spawnEnemies(enemyKeys, floor, difficulty, rng, partySize = 4) {
  // Party-size scalar: 1p = 0.35, 2p = 0.55, 3p = 0.80, 4p = 1.00 of boss stats.
  const bossScalarByParty = { 1: 0.35, 2: 0.55, 3: 0.80, 4: 1.0 };
  const bossScalar = bossScalarByParty[Math.min(4, Math.max(1, partySize))] ?? 1.0;

  return enemyKeys.map((key, idx) => {
    const def = getEnemyOrBoss(key);
    if (!def) throw new Error(`Unknown enemy: ${key}`);
    const stats = def.isBoss
      ? {
          hp: Math.floor(def.base.hp * bossScalar),
          maxHp: Math.floor(def.base.hp * bossScalar),
          atk: Math.floor(def.base.atk * bossScalar),
          def: def.base.def,
          spd: def.base.spd,
        }
      : scaleEnemyStats(def, floor, difficulty);
    return {
      id: `e${idx}_${key}`,
      key,
      name: def.name,
      emoji: def.emoji,
      isBoss: !!def.isBoss,
      ...stats,
      statuses: [],
      buffs: [],
      extras: def.extras || {},
    };
  });
}

// Initiative roll — d20 + SPD
function rollInitiative(run, rng) {
  const order = [];
  for (const p of run.party) {
    if (p.downed) continue;
    order.push({ kind: 'player', id: p.userId, initiative: 1 + rng.int(20) + p.spd });
  }
  for (const e of run.currentRoom.enemies) {
    if (e.hp <= 0) continue;
    order.push({ kind: 'enemy', id: e.id, initiative: 1 + rng.int(20) + e.spd });
  }
  order.sort((a, b) => b.initiative - a.initiative);
  return order;
}

// Apply relic passive buffs at party creation
function applyRelicPassives(run) {
  const ctx = {
    party: run.party,
    partyAtkMul: 1,
    partyCritBonus: 0,
    sourTickDamage: SOUR_TICK_DAMAGE_DEFAULT,
  };
  for (const relicKey of run.relics || []) {
    const relic = getRelic(relicKey);
    if (relic && relic.apply) relic.apply(ctx);
  }
  run._partyAtkMul = ctx.partyAtkMul;
  run._partyCritBonus = ctx.partyCritBonus;
  run._sourTickDamage = ctx.sourTickDamage;
}

// === Effect processing ===
// An "effect" is a { kind, ... } object. Ability handlers and enemy AI return lists of effects.
// processEffect mutates run state and returns a log line.

function findPlayerById(run, id) { return run.party.find(p => p.userId === id); }
function findEnemyById(run, id) { return run.currentRoom?.enemies?.find(e => e.id === id); }

function isPlayerId(run, id) { return !!findPlayerById(run, id); }

function applyStatus(target, statusKey, duration) {
  // Replace existing status of same key with max duration
  const existing = target.statuses.find(s => s.key === statusKey);
  if (existing) {
    existing.duration = Math.max(existing.duration, duration);
  } else {
    target.statuses.push({ key: statusKey, duration });
  }
}

function computeDamage(rawAmount, defender, rng, options = {}) {
  if (options.unblockable) return Math.max(1, Math.floor(rawAmount));
  let dmg = rawAmount - (defender.def || 0);
  // Variance
  const variance = 1 + (rng.next() * 2 - 1) * DAMAGE_VARIANCE;
  dmg = dmg * variance;
  // Crit
  const critChance = (options.critChance ?? BASE_CRIT_CHANCE);
  const crit = rng.chance(critChance);
  if (crit) dmg *= CRIT_MULTIPLIER;
  // Defending reduces incoming damage by 50%
  if (defender.defending) dmg *= 0.5;
  // Shielded blocks entirely
  const shield = defender.statuses && defender.statuses.find(s => s.key === 'shielded');
  if (shield) {
    defender.statuses = defender.statuses.filter(s => s !== shield);
    return { amount: 0, crit: false, blocked: true };
  }
  dmg = Math.max(1, Math.floor(dmg));
  return { amount: dmg, crit, blocked: false };
}

function processEffect(run, effect, sourceName, rng) {
  const logs = [];
  switch (effect.kind) {
    case 'damage': {
      const player = findPlayerById(run, effect.target);
      const enemy = findEnemyById(run, effect.target);
      const target = player || enemy;
      if (!target) break;
      // Dodge check (enemies with dodgeChance)
      if (target.extras && target.extras.dodgeChance && rng.chance(target.extras.dodgeChance)) {
        logs.push(`${sourceName}'s attack on ${target.name || target.username} missed — dodged!`);
        break;
      }
      const { amount, crit, blocked } = computeDamage(effect.amount, target, rng, effect);
      if (blocked) {
        logs.push(`${target.name || target.username}'s shield blocked the hit!`);
        break;
      }
      target.hp = Math.max(0, target.hp - amount);
      logs.push(`${sourceName} hit ${target.name || target.username} for ${amount}${crit ? ' 💥 CRIT' : ''} (${target.hp}/${target.maxHp} HP)`);

      // Whey Warden counter-attack statuses — reflect damage back at the attacker
      if (player && amount > 0) {
        const ripo = player.statuses.find(s => s.key === 'riposte');
        const bulw = player.statuses.find(s => s.key === 'bulwark');
        const unto = player.statuses.find(s => s.key === 'untouchable');
        if (ripo || bulw || unto) {
          // Find the attacker — for enemy-sourced damage, the effect's `target` is the player;
          // `sourceName` is the enemy name, look up the live enemy by name to counter it.
          const attacker = run.currentRoom?.enemies?.find(e => (sourceName || '').includes(e.name) && e.hp > 0);
          if (attacker) {
            const mul = unto ? 1.0 : (ripo?.meta?.mul || 1.0);
            const counterDmg = unto ? amount : Math.floor(player.atk * mul);
            attacker.hp = Math.max(0, attacker.hp - counterDmg);
            logs.push(`⚔️ ${player.username} counters ${attacker.name} for ${counterDmg}!`);
            if (attacker.hp <= 0) logs.push(`☠️ **${attacker.name}** defeated by counter.`);
            // Riposte consumes its status on trigger
            if (ripo) player.statuses = player.statuses.filter(s => s !== ripo);
          }
        }
      }

      if (player && target.hp <= 0 && !player.downed) {
        player.downed = true;
        logs.push(`💀 **${player.username}** is Curdled (downed).`);
        // Fire ally_downed relic hooks (e.g., Curd Locket auto-revive once per run)
        logs.push(...fireRelicHooks(run, 'ally_downed', { targetId: player.userId }));
      }
      if (enemy && target.hp <= 0) {
        logs.push(`☠️ **${enemy.name}** defeated.`);
      }
      break;
    }
    case 'heal': {
      const player = findPlayerById(run, effect.target);
      const enemy = findEnemyById(run, effect.target);
      const target = player || enemy;
      if (!target || target.hp <= 0 && !player?.downed) break;
      const actual = Math.min(effect.amount, target.maxHp - target.hp);
      target.hp += actual;
      logs.push(`✨ ${target.name || target.username} healed for ${actual} (${target.hp}/${target.maxHp} HP)`);
      break;
    }
    case 'status': {
      if (effect.target === 'self' || effect.target === 'party') {
        const targets = effect.target === 'party' ? run.party : [run._currentActor];
        for (const t of targets) applyStatus(t, effect.status, effect.duration);
      } else {
        const target = findPlayerById(run, effect.target) || findEnemyById(run, effect.target);
        if (!target) break;
        applyStatus(target, effect.status, effect.duration);
        logs.push(`${target.name || target.username} is now **${effect.status}** (${effect.duration} turns)`);
      }
      break;
    }
    case 'buff': {
      const target = effect.target === 'self' ? run._currentActor : findPlayerById(run, effect.target);
      if (!target) break;
      target.buffs.push({ stat: effect.stat, amount: effect.amount, duration: effect.duration });
      target[effect.stat] = (target[effect.stat] || 0) + effect.amount;
      break;
    }
    case 'cleanse': {
      const target = findPlayerById(run, effect.target);
      if (!target) break;
      target.statuses = target.statuses.filter(s => ['shielded', 'taunting'].includes(s.key));
      logs.push(`🧼 ${target.username}'s status effects cleansed`);
      break;
    }
    case 'revive': {
      if (run.difficulty === 'hardcore') {
        logs.push(`💀 Revives don't work in Hardcore mode.`);
        break;
      }
      const target = findPlayerById(run, effect.target);
      if (!target || !target.downed) break;
      target.downed = false;
      target.hp = Math.floor(target.maxHp * (effect.hpPct || 0.5));
      target.statuses = [];
      run._revivesUsed = (run._revivesUsed || 0) + 1;
      logs.push(`💫 ${target.username} is revived at ${target.hp}/${target.maxHp} HP!`);
      break;
    }
    case 'strip_buffs': {
      const target = findPlayerById(run, effect.target);
      if (!target) break;
      for (const buff of target.buffs) {
        target[buff.stat] = Math.max(0, (target[buff.stat] || 0) - buff.amount);
      }
      target.buffs = [];
      logs.push(`${target.username}'s buffs stripped!`);
      break;
    }
    case 'flee_combat': {
      run._fleeing = true;
      logs.push('💨 The party escaped the fight.');
      break;
    }
    case 'summon': {
      // Ally summons (Frothmancer) — applied as a caster buff rather than a real entity.
      // MVP: adds an ATK buff and the 'frothling_summoned' status so Sacrifice can detect it.
      if (effect.allied) {
        const caster = run._currentActor;
        if (!caster || !caster.userId) break;
        const existing = caster.statuses.find(s => s.key === 'frothling_summoned');
        if (existing && !effect.force) {
          logs.push(`🫧 ${caster.username} already has a Frothling summoned.`);
          break;
        }
        caster.buffs.push({ stat: 'atk', amount: 8, duration: 999 });
        caster.atk += 8;
        caster.statuses.push({ key: 'frothling_summoned', duration: 999 });
        logs.push(`🫧 A Frothling appears beside ${caster.username}! (+8 ATK)`);
        break;
      }
      // Boss enemy summons
      if (run.currentRoom.enemies.length >= 4) break;
      const def = getEnemyOrBoss(effect.enemyKey);
      if (!def) break;
      const stats = def.isBoss
        ? { hp: def.base.hp, maxHp: def.base.hp, atk: def.base.atk, def: def.base.def, spd: def.base.spd }
        : scaleEnemyStats(def, run.floor, run.difficulty);
      const newEnemy = {
        id: `e${run.currentRoom.enemies.length}_${def.key}_summon`,
        key: def.key,
        name: def.name,
        emoji: def.emoji,
        isBoss: false,
        ...stats,
        statuses: [],
        buffs: [],
        extras: def.extras || {},
      };
      run.currentRoom.enemies.push(newEnemy);
      run.turnOrder.push({ kind: 'enemy', id: newEnemy.id, initiative: 0 });
      logs.push(`👹 **${def.name}** is summoned!`);
      break;
    }
    case 'sacrifice_summon': {
      const caster = run.party.find(p => p.userId === effect.caster);
      if (!caster) break;
      const sumIdx = caster.statuses.findIndex(s => s.key === 'frothling_summoned');
      if (sumIdx === -1) { logs.push(`🫧 ${caster.username} has no summon to sacrifice.`); break; }
      caster.statuses.splice(sumIdx, 1);
      // Remove the +8 ATK buff
      const buffIdx = caster.buffs.findIndex(b => b.stat === 'atk' && b.amount === 8 && b.duration >= 999);
      if (buffIdx !== -1) { caster.atk = Math.max(1, caster.atk - 8); caster.buffs.splice(buffIdx, 1); }
      const healAmt = Math.floor(caster.maxHp * 0.5);
      caster.hp = Math.min(caster.maxHp, caster.hp + healAmt);
      logs.push(`🫧💥 ${caster.username} sacrificed their Frothling — healed ${healAmt} HP.`);
      break;
    }
    default:
      console.warn('[combat] unknown effect:', effect.kind);
  }
  return logs;
}

function processEffects(run, effects, sourceName, rng) {
  const allLogs = [];
  for (const eff of effects) {
    const logs = processEffect(run, eff, sourceName, rng);
    allLogs.push(...logs);
  }
  return allLogs;
}

// === Turn management ===

function startCombat(run, enemyKeys) {
  const rng = run.rng;
  const enemies = spawnEnemies(enemyKeys, run.floor, run.difficulty, rng, run.party.length);
  run.currentRoom = { kind: 'combat', enemies, resolved: false };
  // Reset per-combat player state
  for (const p of run.party) {
    if (!p.downed) p.defending = false;
    p.buffs = []; // clear temp buffs between combats
  }
  run.turnOrder = rollInitiative(run, rng);
  run.turnIndex = 0;
  run._fleeing = false;
  run.log = [`⚔️ A wild ${enemies.map(e => e.name).join(', ')} appears!`];
  applyRelicPassives(run);
  // Fire relic onEvent hooks for combat_start and enemy_spawn
  run.log.push(...fireRelicHooks(run, 'combat_start'));
  for (const e of enemies) {
    run.log.push(...fireRelicHooks(run, 'enemy_spawn', { enemyId: e.id }));
  }
  return run;
}

function isCombatOver(run) {
  if (run._fleeing) return { over: true, victory: true, fled: true };
  const allEnemiesDead = run.currentRoom.enemies.every(e => e.hp <= 0);
  const allPlayersDowned = run.party.every(p => p.downed);
  if (allEnemiesDead) return { over: true, victory: true };
  if (allPlayersDowned) return { over: true, victory: false };
  return { over: false };
}

function currentActor(run) {
  if (!run.turnOrder || run.turnIndex >= run.turnOrder.length) return null;
  const entry = run.turnOrder[run.turnIndex];
  if (entry.kind === 'player') {
    const p = findPlayerById(run, entry.id);
    run._currentActor = p;
    return { kind: 'player', entity: p };
  } else {
    const e = findEnemyById(run, entry.id);
    run._currentActor = e;
    return { kind: 'enemy', entity: e };
  }
}

// Fire a relic onEvent hook. Iterates run.relics and applies any effect that matches the kind.
function fireRelicHooks(run, hookKind, ctx = {}) {
  if (!run.relics || run.relics.length === 0) return [];
  const logs = [];
  run._oncePerRunTriggered = run._oncePerRunTriggered || new Set();
  for (const relicKey of run.relics) {
    const relic = getRelic(relicKey);
    if (!relic || !relic.onEvent || relic.onEvent.kind !== hookKind) continue;
    if (relic.onEvent.oncePerRun && run._oncePerRunTriggered.has(relicKey)) continue;
    const effect = relic.onEvent.effect({ ...ctx, party: run.party, enemies: run.currentRoom?.enemies });
    const effectsArr = Array.isArray(effect) ? effect : [effect];
    for (const eff of effectsArr) {
      if (!eff) continue;
      if (eff.kind === 'xp_mul') {
        run._xpMul = (run._xpMul || 1) * eff.amount;
        continue;
      }
      logs.push(...processEffect(run, eff, relic.name, run.rng));
    }
    if (relic.onEvent.oncePerRun) run._oncePerRunTriggered.add(relicKey);
  }
  return logs;
}

// Advance to next non-dead, non-downed actor. Re-roll initiative at end of round.
function advanceTurn(run) {
  const logs = [];
  // Tick end-of-turn status effects on the current actor
  if (run._currentActor) tickStatuses(run, run._currentActor, logs);

  // Reset defending flag after a player's turn
  if (run._currentActor && run._currentActor.userId) {
    run._currentActor.defending = false;
  }

  // Tick cooldowns for player who just acted
  if (run._currentActor && run._currentActor.cooldowns) {
    for (const key of Object.keys(run._currentActor.cooldowns)) {
      run._currentActor.cooldowns[key] = Math.max(0, run._currentActor.cooldowns[key] - 1);
      if (run._currentActor.cooldowns[key] === 0) delete run._currentActor.cooldowns[key];
    }
  }

  // Tick buffs
  if (run._currentActor && run._currentActor.buffs) {
    const expired = [];
    for (const buff of run._currentActor.buffs) {
      buff.duration -= 1;
      if (buff.duration <= 0) expired.push(buff);
    }
    for (const b of expired) {
      run._currentActor[b.stat] = Math.max(0, (run._currentActor[b.stat] || 0) - b.amount);
      run._currentActor.buffs = run._currentActor.buffs.filter(x => x !== b);
    }
  }

  run.turnIndex += 1;

  // Cap iterations so we cannot infinite-loop if the turn order somehow contains only dead actors.
  // Each pass either advances to a living actor OR rerolls. We give up after 3 rerolls.
  let rerolls = 0;
  while (rerolls < 3) {
    while (run.turnIndex < run.turnOrder.length) {
      const entry = run.turnOrder[run.turnIndex];
      if (entry.kind === 'player') {
        const p = findPlayerById(run, entry.id);
        if (p && !p.downed) return logs;
      } else {
        const e = findEnemyById(run, entry.id);
        if (e && e.hp > 0) return logs;
      }
      run.turnIndex += 1;
    }
    // End of turn order — reroll initiative.
    run.turnOrder = rollInitiative(run, run.rng);
    run.turnIndex = 0;
    rerolls++;
  }
  // Nothing alive to act — mark the combat over (caller's isCombatOver check will handle).
  return logs;
}

function tickStatuses(run, entity, logs) {
  if (!entity || !entity.statuses) return;
  const remaining = [];
  for (const status of entity.statuses) {
    // Apply per-turn effects
    if (status.key === 'sour') {
      const dmg = run._sourTickDamage || SOUR_TICK_DAMAGE_DEFAULT;
      entity.hp = Math.max(0, entity.hp - dmg);
      logs.push(`🟢 ${entity.name || entity.username} takes ${dmg} Sour damage`);
      if (entity.userId && entity.hp <= 0 && !entity.downed) {
        entity.downed = true;
        logs.push(`💀 **${entity.username}** is Curdled.`);
      }
    }
    status.duration -= 1;
    if (status.duration > 0) remaining.push(status);
    else logs.push(`${entity.name || entity.username}'s ${status.key} wore off`);
  }
  entity.statuses = remaining;
}

// === Player actions ===

function playerAttack(run, player) {
  // Default target: first living enemy
  const target = run.currentRoom.enemies.find(e => e.hp > 0);
  if (!target) return [];
  const atk = player.atk * (run._partyAtkMul || 1);
  const critChance = BASE_CRIT_CHANCE + (run._partyCritBonus || 0);
  return [{ kind: 'damage', target: target.id, amount: atk, critChance }];
}

function playerDefend(run, player) {
  player.defending = true;
  return [];
}

function playerAbility(run, player, abilityKey, targetId) {
  const cls = getClass(player.classKey);
  const ability = cls.abilities.find(a => a.key === abilityKey);
  if (!ability) return { error: 'unknown ability' };
  if (player.cooldowns[abilityKey]) {
    return { error: `${ability.name} is on cooldown (${player.cooldowns[abilityKey]} turns)` };
  }
  const ctx = {
    atk: player.atk * (run._partyAtkMul || 1),
    enemies: run.currentRoom.enemies,
    party: run.party,
    targetId,
    self: player,
    rng: run.rng,
  };
  const effects = ability.run(ctx);
  player.cooldowns[abilityKey] = ability.cooldown || 1;
  return { effects, abilityName: ability.name };
}

// Enemy AI — call behavior() and return effects
function enemyTurn(run, enemy) {
  const def = getEnemyOrBoss(enemy.key);
  if (!def) return [];
  // Curdled = skip this turn
  if (enemy.statuses.some(s => s.key === 'curdled')) {
    return { skipped: true, logs: [`${enemy.name} is curdled and can't act.`] };
  }
  const ctx = {
    atk: enemy.atk,
    enemies: run.currentRoom.enemies,
    party: run.party,
    selfId: enemy.id,
    self: enemy,
    rng: run.rng,
    pickLivingPlayer: () => {
      const living = run.party.filter(p => !p.downed);
      if (living.length === 0) return null;
      // If any player is taunting, prefer them
      const taunting = living.find(p => p.statuses.some(s => s.key === 'taunting'));
      if (taunting) return taunting;
      return living[run.rng.int(living.length)];
    },
  };
  return { effects: def.behavior(ctx) };
}

module.exports = {
  scaleEnemyStats,
  initPlayer,
  spawnEnemies,
  applyRelicPassives,
  startCombat,
  isCombatOver,
  currentActor,
  advanceTurn,
  processEffects,
  playerAttack,
  playerDefend,
  playerAbility,
  enemyTurn,
  rollInitiative,
  fireRelicHooks,
};
