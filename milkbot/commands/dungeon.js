// Dungeon command — entry command + full game-loop orchestration.
// Big file on purpose; mirrors existing pattern (see bjt.js, raidboss.js).

const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { withLock } = require('../balancelock');
const dungeon = require('../dungeon');
const { state, combat, rooms, display, classes, loot } = dungeon;
const { getEvent, resolveRoll } = require('../dungeon/events');
const { getGate, classUnlockFor, hasCompletedDungeon } = require('../dungeon/unlocks');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const ENTRY_COST = 1000;
const FINAL_FLOOR = 10;
const BASE_REWARD_PER_FLOOR = 500;
const BASE_XP_PER_FLOOR = 100;
const TURN_TIMEOUT_MS = 90_000;
const PARTY_IDLE_TIMEOUT_MS = 15 * 60_000;

// Cached references to persistent channel panels so we can edit them in place.
const channelPanels = new Map();  // guildId -> { explainerId, lobbyId }

// ========= Balance helpers =========

function readBalances() {
  try { return JSON.parse(fs.readFileSync(balancesPath, 'utf8')); } catch { return {}; }
}
function writeBalances(data) {
  const tmp = balancesPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, balancesPath);
}
function readXp() {
  try { return JSON.parse(fs.readFileSync(xpPath, 'utf8')); } catch { return {}; }
}
function writeXp(data) {
  const tmp = xpPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, xpPath);
}

async function chargeEntry(userId) {
  return withLock('bal:' + userId, async () => {
    const bals = readBalances();
    const have = bals[userId] || 0;
    if (have < ENTRY_COST) return { ok: false, reason: 'insufficient', have };
    bals[userId] = have - ENTRY_COST;
    writeBalances(bals);
    return { ok: true };
  });
}

async function payout(userId, bucks, xp) {
  return withLock('bal:' + userId, async () => {
    if (bucks > 0) {
      const bals = readBalances();
      bals[userId] = Math.min(1_000_000_000, (bals[userId] || 0) + bucks);
      writeBalances(bals);
    }
    if (xp > 0) {
      const xps = readXp();
      xps[userId] = (xps[userId] || 0) + xp;
      writeXp(xps);
    }
  });
}

// ========= Channel panels (top explainer + bottom lobby) =========

async function refreshChannelPanels(client, channel) {
  // One persistent message per dungeon (plus explainer + stats). Data-driven:
  // adding a dungeon is a DUNGEON_META entry, no edits here.
  //
  // Order matters — the explainer MUST be the oldest (top) message, followed
  // by each dungeon panel in DUNGEON_META order, then the stats row. Discord
  // snowflake IDs are time-ordered: smaller = older = higher in channel.
  const dungeonIds = Object.keys(display.DUNGEON_META);

  let explainerMsg = null, statsMsg = null;
  const dungeonMsgs = {};  // dungeonId -> Message
  const orphansToDelete = [];

  try {
    const recent = await channel.messages.fetch({ limit: 50 });
    for (const m of recent.values()) {
      if (m.author.id !== client.user.id) continue;
      const title = m.embeds[0]?.title || '';
      // Explainer recognised by the top "MilkBot Dungeons" header (or legacy titles).
      if (title.includes('MilkBot Dungeon') && !dungeonIds.some(id => title.includes(display.DUNGEON_META[id].displayName))) {
        explainerMsg = m;
        continue;
      }
      // Match dungeon panels by their displayName.
      let matched = false;
      for (const id of dungeonIds) {
        const meta = display.DUNGEON_META[id];
        if (title.includes(meta.displayName)) {
          dungeonMsgs[id] = m;
          matched = true;
          break;
        }
      }
      if (matched) continue;
      // Stats row: new embed-based ledger title, or legacy '───' content fallback.
      if (title.includes('Your Dungeon Ledger') || (!m.embeds.length && m.content.includes('───'))) { statsMsg = m; continue; }
      // Old v1 lobby panel (pre-split) — orphan, remove.
      if (title.includes('Dungeon Lobby')) orphansToDelete.push(m);
    }
  } catch (e) {
    console.warn('[dungeon] fetch panels failed:', e.message);
  }

  // Verify strict ordering: explainer → each dungeon panel (in DUNGEON_META
  // order) → stats row. Discord snowflake IDs are time-ordered: smaller = older
  // = higher in channel. If the sequence isn't monotonically increasing, the
  // channel picked up something out of position (e.g. the Creamspire panel
  // was added later, so the stats row is above it). Wipe and re-post.
  const orderBroken = (() => {
    const sequence = [];
    if (explainerMsg) sequence.push(explainerMsg);
    for (const id of dungeonIds) if (dungeonMsgs[id]) sequence.push(dungeonMsgs[id]);
    if (statsMsg) sequence.push(statsMsg);
    for (let i = 1; i < sequence.length; i++) {
      if (BigInt(sequence[i].id) < BigInt(sequence[i - 1].id)) return true;
    }
    return false;
  })();

  if (orderBroken) {
    console.log('[dungeon] panel order broken — wiping and re-posting');
    const all = [explainerMsg, ...Object.values(dungeonMsgs), statsMsg].filter(Boolean);
    for (const m of all) await m.delete().catch(() => {});
    explainerMsg = null;
    for (const k of Object.keys(dungeonMsgs)) delete dungeonMsgs[k];
    statsMsg = null;
  }

  for (const m of orphansToDelete) {
    await m.delete().catch(() => {});
    console.log('[dungeon] deleted orphan panel:', m.embeds[0]?.title || '(no title)');
  }

  // Post/edit in strict top-to-bottom order. When a message is missing we
  // send fresh; when it exists we edit in place so its position is preserved.
  const explainerPayload = display.buildExplainerEmbed();
  if (explainerMsg) await explainerMsg.edit(explainerPayload).catch(() => {});
  else explainerMsg = await channel.send(explainerPayload).catch(() => null);

  const runs = state.allRuns();
  const panelIdMap = {};
  for (const dungeonId of dungeonIds) {
    const payload = display.buildLobbyPanel(runs, dungeonId, true);
    let msg = dungeonMsgs[dungeonId];
    if (msg) await msg.edit(payload).catch(() => {});
    else msg = await channel.send(payload).catch(() => null);
    panelIdMap[dungeonId] = msg?.id;
  }

  const statsPayload = display.buildStatsButton();
  if (statsMsg) await statsMsg.edit(statsPayload).catch(() => {});
  else statsMsg = await channel.send(statsPayload).catch(() => null);

  channelPanels.set(channel.guildId, {
    channelId: channel.id,
    explainerId: explainerMsg?.id,
    panelIds: panelIdMap,
    statsId: statsMsg?.id,
  });
}

async function refreshLobby(client) {
  for (const [guildId, panel] of channelPanels) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    const channel = guild.channels.cache.get(panel.channelId);
    if (!channel) continue;
    const runs = state.allRuns();
    const ids = panel.panelIds || {};
    for (const [dungeonId, messageId] of Object.entries(ids)) {
      if (!messageId) continue;
      try {
        const msg = await channel.messages.fetch(messageId);
        await msg.edit(display.buildLobbyPanel(runs, dungeonId, true));
      } catch {}
    }
  }
}

// ========= Thread creation =========

async function createDungeonThread(channel, creatorName, runId) {
  // Prefer private thread. Fall back to public if guild lacks Community features.
  const privateAllowed = channel.guild.features.includes('COMMUNITY');
  const safeName = sanitizeUsername(creatorName);
  const threadName = `${safeName}'s Descent — ${runId.slice(0, 6)}`;
  const type = privateAllowed ? ChannelType.PrivateThread : ChannelType.PublicThread;
  const thread = await channel.threads.create({
    name: threadName,
    type,
    autoArchiveDuration: 1440,
    invitable: false,
    reason: `Dungeon run ${runId}`,
  });
  return thread;
}

// ========= Handlers =========

async function execute() { /* not used — lobby buttons are the entry */ }
async function executeSlash(interaction) {
  await interaction.reply({ content: '🏰 The dungeon lobby is in **#milkbot-dungeon** — click **Start a Run** there.', flags: 64 });
}

async function handleButtonInteraction(interaction) {
  if (process.env.DUNGEON_ENABLED !== '1') {
    return interaction.reply({ content: 'Dungeon is not enabled right now.', flags: 64 }).catch(() => {});
  }
  const id = interaction.customId;
  try {
    if (id === 'dun_start' || id === 'dun_start_normal') return handleStart(interaction, 'normal', 'spoiled_vault');
    if (id === 'dun_start_hardcore') return handleStart(interaction, 'hardcore', 'spoiled_vault');
    // Dynamic: dun_start_<dungeonId>_<normal|hardcore>
    if (id.startsWith('dun_start_')) {
      const rest = id.slice('dun_start_'.length);
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore > 0) {
        const dungeonId = rest.slice(0, lastUnderscore);
        const difficulty = rest.slice(lastUnderscore + 1);
        if (display.DUNGEON_META[dungeonId] && (difficulty === 'normal' || difficulty === 'hardcore')) {
          return handleStart(interaction, difficulty, dungeonId);
        }
      }
    }
    if (id === 'dun_stats') return handleStats(interaction);
    if (id.startsWith('dun_join_')) return handleJoin(interaction, id.slice('dun_join_'.length));
    if (id.startsWith('dun_pick_')) {
      const rest = id.slice('dun_pick_'.length);
      const firstUnderscore = rest.indexOf('_');
      const runId = rest.slice(0, firstUnderscore);
      const classKey = rest.slice(firstUnderscore + 1);
      return handleClassPick(interaction, runId, classKey);
    }
    if (id.startsWith('dun_atk_')) return handleAction(interaction, id.slice('dun_atk_'.length), 'attack');
    if (id.startsWith('dun_def_')) return handleAction(interaction, id.slice('dun_def_'.length), 'defend');
    if (id.startsWith('dun_abi_')) {
      const rest = id.slice('dun_abi_'.length);
      const underscore = rest.indexOf('_');
      const runId = rest.slice(0, underscore);
      const abilityKey = rest.slice(underscore + 1);
      return handleAction(interaction, runId, 'ability', { abilityKey });
    }
    if (id.startsWith('dun_item_')) return handleItemMenu(interaction, id.slice('dun_item_'.length));
    if (id.startsWith('dun_useitem_')) {
      const rest = id.slice('dun_useitem_'.length);
      const underscore = rest.indexOf('_');
      const runId = rest.slice(0, underscore);
      const itemIdx = Number(rest.slice(underscore + 1));
      return handleUseItem(interaction, runId, itemIdx);
    }
    if (id.startsWith('dun_chest_')) {
      const rest = id.slice('dun_chest_'.length);
      const underscore = rest.lastIndexOf('_');
      const runId = rest.slice(0, underscore);
      const chestIdx = Number(rest.slice(underscore + 1));
      return handleChest(interaction, runId, chestIdx);
    }
    if (id.startsWith('dun_evc_')) {
      const rest = id.slice('dun_evc_'.length);
      const underscore = rest.lastIndexOf('_');
      const runId = rest.slice(0, underscore);
      const choiceIdx = Number(rest.slice(underscore + 1));
      return handleEventChoice(interaction, runId, choiceIdx);
    }
    if (id.startsWith('dun_buy_')) {
      const rest = id.slice('dun_buy_'.length);
      const underscore = rest.lastIndexOf('_');
      const runId = rest.slice(0, underscore);
      const itemIdx = Number(rest.slice(underscore + 1));
      return handleBuy(interaction, runId, itemIdx);
    }
    if (id.startsWith('dun_leave_')) return handleLeave(interaction, id.slice('dun_leave_'.length));
    if (id.startsWith('dun_abandon_')) return handleAbandon(interaction, id.slice('dun_abandon_'.length));
  } catch (e) {
    console.error('[dungeon] interaction error:', e);
    try { await interaction.reply({ content: `⚠️ Something went wrong: ${e.message}`, flags: 64 }); } catch {}
  }
}

async function handleStart(interaction, difficulty = 'normal', dungeonId = 'spoiled_vault') {
  const userId = interaction.user.id;
  const username = sanitizeUsername(interaction.user.globalName || interaction.user.username);

  // Unlock gate: each dungeon may require completing a prior one. Table-driven.
  const gate = getGate(dungeonId);
  if (gate && gate.requiresCompletion) {
    const stats = state.getUserStats(userId);
    if (!hasCompletedDungeon(stats, gate.requiresCompletion)) {
      const meta = display.DUNGEON_META?.[dungeonId];
      const prevMeta = display.DUNGEON_META?.[gate.requiresCompletion];
      const name = meta?.displayName || dungeonId;
      const prevName = prevMeta?.displayName || gate.requiresCompletion;
      return interaction.reply({ content: `🔒 **${name} is locked.** Complete **${prevName}** first. 🥛`, flags: 64 });
    }
  }

  // Check if user already in an active run
  const existing = state.allRuns().find(r => r.party.some(p => p.userId === userId));
  if (existing) {
    return interaction.reply({ content: `You're already in a run (${existing.runId}).`, flags: 64 });
  }

  // Charge entry
  const charge = await chargeEntry(userId);
  if (!charge.ok) {
    return interaction.reply({ content: `You need **${ENTRY_COST.toLocaleString()}** milk bucks to descend. You have ${(charge.have || 0).toLocaleString()}.`, flags: 64 });
  }

  await interaction.deferReply({ flags: 64 });

  const run = state.createRun({
    creatorId: userId,
    creatorName: username,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    difficulty,
    dungeonId,
  });
  run.pot = ENTRY_COST;
  run.party.push(makePartySlot(userId, username));
  state.markDirty(run);

  // Create thread
  let thread;
  try {
    thread = await createDungeonThread(interaction.channel, username, run.runId);
    run.threadId = thread.id;
    await thread.members.add(userId);
    state.markDirty(run);
  } catch (e) {
    console.error('[dungeon] thread create failed:', e);
    // Refund on failure
    await payout(userId, ENTRY_COST, 0);
    state.deleteRun(run.runId);
    return interaction.editReply({ content: `Couldn't create your dungeon thread: ${e.message}` });
  }

  // Post class picker in thread (pass user's class + ability unlocks so
  // completion-earned classes and mastery skills are clickable).
  const userStats = state.getUserStats(userId);
  await thread.send(display.buildClassPicker(run, userId, userStats.abilityUnlocks || [], userStats.classUnlocks || []));
  await thread.send({ content: `Party forming — **${run.party.length}/${run.maxPartySize}**. Waiting for others to join from #milkbot-dungeon. When everyone's picked a class, the descent begins.` });

  await interaction.editReply({ content: `🏰 Your descent is ready: <#${thread.id}>` });
  await refreshLobby(interaction.client);
}

async function handleJoin(interaction, runId) {
  const userId = interaction.user.id;
  const username = sanitizeUsername(interaction.user.globalName || interaction.user.username);

  const result = await withLock('dun:' + runId, async () => {
    const run = state.getRun(runId);
    if (!run) return { error: "That run doesn't exist anymore." };
    if (run.state !== 'LOBBY') return { error: "That run already started." };
    if (run.party.some(p => p.userId === userId)) return { error: "You're already in that party." };
    if (run.party.length >= run.maxPartySize) return { error: "That party is full." };
    if (state.allRuns().some(r => r.runId !== runId && r.party.some(p => p.userId === userId))) {
      return { error: "You're already in a different active run." };
    }
    return { run };
  });

  if (result.error) return interaction.reply({ content: result.error, flags: 64 });

  // Charge entry AFTER lock check but before adding (fail refund logic simpler)
  const charge = await chargeEntry(userId);
  if (!charge.ok) {
    return interaction.reply({ content: `You need **${ENTRY_COST.toLocaleString()}** milk bucks to join. You have ${(charge.have || 0).toLocaleString()}.`, flags: 64 });
  }

  await interaction.deferReply({ flags: 64 });

  await withLock('dun:' + runId, async () => {
    const run = state.getRun(runId);
    // Re-check capacity inside lock
    if (!run || run.state !== 'LOBBY' || run.party.length >= run.maxPartySize || run.party.some(p => p.userId === userId)) {
      // race — refund
      await payout(userId, ENTRY_COST, 0);
      return;
    }
    run.party.push(makePartySlot(userId, username));
    run.pot += ENTRY_COST;
    state.markDirty(run);

    // Add to thread
    try {
      const thread = await interaction.client.channels.fetch(run.threadId);
      await thread.members.add(userId);
      const joinerStats = state.getUserStats(userId);
      await thread.send(display.buildClassPicker(run, userId, joinerStats.abilityUnlocks || [], joinerStats.classUnlocks || []));
      await thread.send(`🥛 **${username}** joined — ${run.party.length}/${run.maxPartySize}`);
    } catch (e) {
      console.warn('[dungeon] add-to-thread failed:', e.message);
    }
  });

  await interaction.editReply({ content: `✅ Joined. Check <#${state.getRun(runId)?.threadId}>.` });
  await refreshLobby(interaction.client);
}

async function handleClassPick(interaction, runId, classKey) {
  const userId = interaction.user.id;
  const cls = classes.getClass(classKey);
  if (!cls) return interaction.reply({ content: 'Unknown class.', flags: 64 });
  if (!cls.unlockedByDefault) return interaction.reply({ content: `${cls.name} is locked.`, flags: 64 });

  await withLock('dun:' + runId, async () => {
    const run = state.getRun(runId);
    if (!run) return;
    const slot = run.party.find(p => p.userId === userId);
    if (!slot) return;
    if (slot.classKey) return; // already picked
    Object.assign(slot, combat.initPlayer({ userId, username: slot.username, classKey }));
    state.markDirty(run);

    const allPicked = run.party.every(p => p.classKey);
    if (allPicked && run.party.length >= 1) {
      run.state = 'PLAYING';
      state.markDirty(run);
    }
  });

  await interaction.reply({ content: `Locked in as **${cls.name}** ${cls.emoji}. ${state.getRun(runId)?.state === 'PLAYING' ? 'Descending now!' : 'Waiting for others.'}`, flags: 64 });

  const run = state.getRun(runId);
  if (run && run.state === 'PLAYING') {
    const thread = await interaction.client.channels.fetch(run.threadId).catch(() => null);
    if (thread) await beginFloor(run, thread);
  }
}

// Strip control chars, markdown formatting, and Discord mentions; cap 32 chars.
// Prevents markdown injection into embeds + keeps thread names well-formed.
function sanitizeUsername(raw) {
  if (!raw) return 'Player';
  return String(raw)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[*_~`|\\]/g, '')
    .replace(/@(everyone|here)/gi, '$1')
    .replace(/<@[!&]?\d+>/g, '')
    .slice(0, 32)
    .trim() || 'Player';
}

function makePartySlot(userId, username) {
  return { userId, username: sanitizeUsername(username), classKey: null, hp: 0, maxHp: 0, atk: 0, def: 0, spd: 0, statuses: [], cooldowns: {}, items: [], buffs: [], downed: false, defending: false };
}

// ========= Game loop =========

async function beginFloor(run, thread) {
  const room = rooms.generateRoom(run);
  run.currentRoom = room;
  state.markDirty(run);

  if (room.kind === 'combat' || room.kind === 'elite' || room.kind === 'boss') {
    combat.startCombat(run, room.enemyKeys);
    state.markDirty(run);
    await postStatus(run, thread, true);
    let intro = `⬇️ **Floor ${run.floor}** begins.`;
    if (room.kind === 'elite') intro = `⚠️ **Floor ${run.floor}** — elite encounter!`;
    if (room.kind === 'boss') intro = `🔥 **Floor ${run.floor} — BOSS FIGHT.** ${run.currentRoom.enemyKeys.join(', ')}`;
    await thread.send({ content: intro }).catch(() => {});
    await processTurn(run, thread);
    return;
  }

  await postStatus(run, thread, true);
  if (room.kind === 'treasure') return enterTreasureRoom(run, thread);
  if (room.kind === 'event') return enterEventRoom(run, thread);
  if (room.kind === 'merchant') return enterMerchantRoom(run, thread);
  if (room.kind === 'rest') return enterRestRoom(run, thread);
  console.warn('[dungeon] unknown room kind:', room.kind);
}

async function enterTreasureRoom(run, thread) {
  await thread.send(display.buildTreasureRoom(run)).catch(() => {});
}

async function enterEventRoom(run, thread) {
  const event = getEvent(run.currentRoom.eventKey);
  if (!event) {
    console.warn('[dungeon] unknown event:', run.currentRoom.eventKey);
    return advanceToNextFloor(run, thread);
  }
  await thread.send(display.buildEventRoom(run, event)).catch(() => {});
}

async function enterMerchantRoom(run, thread) {
  await thread.send(display.buildMerchantRoom(run)).catch(() => {});
}

async function enterRestRoom(run, thread) {
  const healed = 40;
  for (const p of run.party) {
    if (p.downed) continue;
    p.hp = Math.min(p.maxHp, p.hp + healed);
  }
  state.markDirty(run);
  await thread.send(display.buildRestRoom(run, healed)).catch(() => {});
  setTimeout(() => advanceToNextFloor(run, thread).catch(() => {}), 2500);
}

async function advanceToNextFloor(run, thread) {
  // Track deepest floor reached
  if (run.floor > (run.deepestFloor || 0)) run.deepestFloor = run.floor;

  // Fire floor_start relic hooks (e.g., Frothing Chalice heal-per-floor)
  const hookLogs = combat.fireRelicHooks(run, 'floor_start');
  if (hookLogs.length) run.log.push(...hookLogs);

  // Class unlock: clearing floor 5 unlocks the dungeon's designated class.
  if (run.floor === 5) {
    const unlockKey = classUnlockFor(run.dungeonId || 'spoiled_vault', 5);
    if (unlockKey) {
      const unlockName = classes.getClass(unlockKey)?.name || unlockKey;
      for (const p of run.party) {
        const stats = state.getUserStats(p.userId);
        if (!stats.classUnlocks.includes(unlockKey)) {
          state.updateUserStats(p.userId, s => {
            if (!s.classUnlocks.includes(unlockKey)) s.classUnlocks.push(unlockKey);
          });
          run.log.push(`🗝️ ${p.username} unlocked **${unlockName}**!`);
        }
      }
    }
  }

  if (run.floor >= FINAL_FLOOR) return endRun(run, thread, 'victory');
  // Render the "floor cleared" message for the floor we JUST beat, before
  // advancing to the next. Previously this showed run.floor after the
  // increment so each cleared message was one floor ahead.
  const clearedFloor = run.floor;
  run.floor += 1;
  // Auto-revive between floors — SKIPPED in hardcore mode
  if (run.difficulty !== 'hardcore') {
    for (const p of run.party) {
      if (p.downed) {
        p.downed = false;
        p.hp = Math.floor(p.maxHp * 0.5);
        run.log.push(`🌱 ${p.username} stands back up at ${p.hp}/${p.maxHp} HP`);
      }
    }
  }
  state.markDirty(run);
  await thread.send(display.buildFloorClearedEmbed(run, clearedFloor)).catch(() => {});
  setTimeout(() => beginFloor(run, thread).catch(() => {}), 1500);
}

async function postStatus(run, thread, fresh = false) {
  const payload = display.buildStatusEmbed(run);
  try {
    if (fresh || !run.statusMessageId) {
      const msg = await thread.send(payload);
      run.statusMessageId = msg.id;
      state.markDirty(run);
    } else {
      const msg = await thread.messages.fetch(run.statusMessageId).catch(() => null);
      if (msg) await msg.edit(payload);
      else {
        const newMsg = await thread.send(payload);
        run.statusMessageId = newMsg.id;
        state.markDirty(run);
      }
    }
  } catch (e) {
    console.warn('[dungeon] status post failed:', e.message);
  }
}

async function processTurn(run, thread) {
  if (run.state !== 'PLAYING') return;

  const end = combat.isCombatOver(run);
  if (end.over) {
    return handleCombatEnd(run, thread, end);
  }

  const actor = combat.currentActor(run);
  if (!actor) {
    console.warn('[dungeon] no current actor');
    return;
  }

  if (actor.kind === 'player') {
    await promptPlayerTurn(run, thread, actor.entity);
  } else {
    await processEnemyTurn(run, thread, actor.entity);
  }
}

async function promptPlayerTurn(run, thread, player) {
  // Hard guard: if the turn's "actor" is missing or has no class, the combat
  // state is corrupt — skip the entry so the fight isn't stalled forever.
  if (!player || !player.classKey || !classes.getClass(player.classKey)) {
    console.warn('[dungeon] promptPlayerTurn: invalid actor, advancing turn');
    combat.advanceTurn(run);
    state.markDirty(run);
    return processTurn(run, thread);
  }

  await postStatus(run, thread);

  // Delete the previous turn prompt so the thread doesn't accumulate them.
  if (run._activeTurnMessageId) {
    try {
      const prev = await thread.messages.fetch(run._activeTurnMessageId);
      await prev.delete();
    } catch { /* already gone */ }
  }

  const cls = classes.getClass(player.classKey);
  const prompt = `<@${player.userId}> — ${cls.emoji} **${cls.name}** turn`;
  const userStats = state.getUserStats(player.userId);
  const { embeds, components } = display.buildTurnActions(run, player, userStats.abilityUnlocks || []);
  try {
    const msg = await thread.send({ content: prompt, embeds, components });
    run._activeTurnMessageId = msg.id;
    state.markDirty(run);
  } catch (e) { console.warn('[dungeon] turn prompt failed:', e.message); }

  clearTimeout(run._turnTimer);
  run._turnTimer = setTimeout(() => autoAttackOnTimeout(run, thread, player.userId).catch(() => {}), TURN_TIMEOUT_MS);
}

async function autoAttackOnTimeout(run, thread, userId) {
  await withLock('dun:' + run.runId, async () => {
    if (run.state !== 'PLAYING') return;
    const actor = combat.currentActor(run);
    if (!actor || actor.kind !== 'player' || actor.entity.userId !== userId) return;
    const effects = combat.playerAttack(run, actor.entity);
    const logs = combat.processEffects(run, effects, actor.entity.username, run.rng);
    run.log.push(...logs, `⏱️ **${actor.entity.username}** auto-attacked (timeout)`);
    combat.advanceTurn(run);
    state.markDirty(run);
  });
  await processTurn(run, thread);
}

async function processEnemyTurn(run, thread, enemy) {
  await withLock('dun:' + run.runId, async () => {
    const res = combat.enemyTurn(run, enemy);
    if (res.skipped) {
      run.log.push(...res.logs);
    } else {
      const logs = combat.processEffects(run, res.effects, enemy.name, run.rng);
      run.log.push(...logs);
    }
    combat.advanceTurn(run);
    state.markDirty(run);
  });
  // Slight delay for pacing
  setTimeout(() => processTurn(run, thread).catch(() => {}), 900);
}

async function handleAction(interaction, runId, action, data = {}) {
  const userId = interaction.user.id;
  let result = null;

  await withLock('dun:' + runId, async () => {
    const run = state.getRun(runId);
    if (!run || run.state !== 'PLAYING') {
      result = { error: 'Run is not active.' };
      return;
    }
    const actor = combat.currentActor(run);
    if (!actor || actor.kind !== 'player' || actor.entity.userId !== userId) {
      result = { error: "It's not your turn." };
      return;
    }
    const player = actor.entity;
    if (player.downed) {
      result = { error: "You're downed." };
      return;
    }
    clearTimeout(run._turnTimer);

    let effects = [];
    let sourceName = player.username;
    let logPrefix = '';
    if (action === 'attack') {
      effects = combat.playerAttack(run, player);
      logPrefix = `⚔️ ${player.username} attacks`;
    } else if (action === 'defend') {
      combat.playerDefend(run, player);
      logPrefix = `🛡️ ${player.username} defends`;
    } else if (action === 'ability') {
      const r = combat.playerAbility(run, player, data.abilityKey, data.targetId);
      if (r.error) { result = { error: r.error }; return; }
      effects = r.effects;
      logPrefix = `✨ ${player.username} uses ${r.abilityName}`;
    }
    const logs = combat.processEffects(run, effects, sourceName, run.rng);
    if (logPrefix && effects.length === 0) run.log.push(logPrefix);
    else if (logPrefix) run.log.push(logPrefix, ...logs);
    else run.log.push(...logs);
    combat.advanceTurn(run);
    state.markDirty(run);
    result = { ok: true };
  });

  if (result && result.error) {
    return interaction.reply({ content: result.error, flags: 64 });
  }
  await interaction.deferUpdate().catch(() => {});
  const run = state.getRun(runId);
  const thread = await interaction.client.channels.fetch(run.threadId).catch(() => null);
  if (thread) await processTurn(run, thread);
}

async function handleItemMenu(interaction, runId) {
  const run = state.getRun(runId);
  if (!run) return interaction.reply({ content: 'Run not found.', flags: 64 });
  const player = run.party.find(p => p.userId === interaction.user.id);
  if (!player) return interaction.reply({ content: "You're not in this run.", flags: 64 });
  const consumablesByKey = Object.fromEntries(loot.listConsumables().map(c => [c.key, c]));
  return interaction.reply(display.buildItemPicker(run, player, consumablesByKey));
}

async function handleUseItem(interaction, runId, itemIdx) {
  const userId = interaction.user.id;
  let result = null;
  await withLock('dun:' + runId, async () => {
    const run = state.getRun(runId);
    if (!run) { result = { error: 'Run not found.' }; return; }
    const player = run.party.find(p => p.userId === userId);
    if (!player || !player.items[itemIdx]) { result = { error: 'Item not found.' }; return; }
    const itemKey = player.items[itemIdx];
    const consumable = loot.getConsumable(itemKey);
    if (!consumable) { result = { error: 'Unknown item.' }; return; }

    // Resolve target based on the item's targetKind so revive-type items
    // actually hit downed allies instead of silently fizzling on the caster.
    let targetId = userId;
    if (consumable.targetKind === 'ally_downed') {
      const downed = run.party.find(p => p.downed);
      if (!downed) {
        result = { error: 'No downed ally to revive.' };
        return;
      }
      targetId = downed.userId;
    } else if (consumable.targetKind === 'ally') {
      const wounded = run.party
        .filter(p => !p.downed)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (wounded) targetId = wounded.userId;
    }

    const ctx = {
      userId,
      targetId,
      party: run.party,
      enemies: run.currentRoom?.enemies || [],
    };
    const effects = consumable.use(ctx);
    const logs = combat.processEffects(run, effects, `${player.username} (${consumable.name})`, run.rng);
    run.log.push(...logs);
    // Remove the item on successful use.
    player.items.splice(itemIdx, 1);
    state.markDirty(run);
    const targetPlayer = run.party.find(p => p.userId === targetId);
    const targetedLine = targetPlayer && targetId !== userId
      ? ` on **${targetPlayer.username}**`
      : '';
    result = { ok: true, name: consumable.name, targetedLine };
  });
  if (result.error) return interaction.reply({ content: result.error, flags: 64 });
  await interaction.reply({ content: `✅ Used ${result.name}${result.targetedLine}`, flags: 64 });
  const run = state.getRun(runId);
  const thread = await interaction.client.channels.fetch(run.threadId).catch(() => null);
  if (thread) postStatus(run, thread).catch(() => {});
}

async function handleChest(interaction, runId, chestIdx) {
  const userId = interaction.user.id;
  let replyText = '';
  let shouldAdvance = false;
  await withLock('dun:' + runId, async () => {
    const run = state.getRun(runId);
    if (!run || run.currentRoom?.kind !== 'treasure') { replyText = 'Not a treasure room.'; return; }
    const player = run.party.find(p => p.userId === userId);
    if (!player) { replyText = "You're not in this run."; return; }
    const room = run.currentRoom;
    if (room.claimed[userId] !== undefined) { replyText = 'You already picked.'; return; }
    if (Object.values(room.claimed).includes(chestIdx)) { replyText = 'Already claimed.'; return; }
    room.claimed[userId] = chestIdx;
    const chest = room.chests[chestIdx];
    if (chest.kind === 'relic') {
      if (!run.relics.includes(chest.item.key)) {
        run.relics.push(chest.item.key);
        replyText = `🎁 Relic: **${chest.item.name}** — ${chest.item.description}`;
      } else {
        replyText = `🎁 Duplicate relic (converted to 200 🥛)`;
        run.pot += 200;
      }
    } else {
      player.items.push(chest.item.key);
      replyText = `🎁 Item: **${chest.item.name}**`;
    }
    state.markDirty(run);
    // Advance when everyone's picked OR 1+ minute pass (for now, advance when all picked or 3 claims total)
    const claimsCount = Object.keys(room.claimed).length;
    if (claimsCount >= Math.min(run.party.length, room.chests.length)) {
      shouldAdvance = true;
    }
  });
  await interaction.reply({ content: replyText, flags: 64 });
  if (shouldAdvance) {
    const run = state.getRun(runId);
    const thread = await interaction.client.channels.fetch(run.threadId).catch(() => null);
    if (thread) setTimeout(() => advanceToNextFloor(run, thread).catch(() => {}), 1500);
  }
}

async function handleEventChoice(interaction, runId, choiceIdx) {
  const userId = interaction.user.id;
  let replyText = '';
  let shouldAdvance = false;
  let spawnCombatKeys = null;
  await withLock('dun:' + runId, async () => {
    const run = state.getRun(runId);
    if (!run || run.currentRoom?.kind !== 'event' || run.currentRoom.resolved) {
      replyText = 'Event already resolved.';
      return;
    }
    const event = getEvent(run.currentRoom.eventKey);
    if (!event || !event.choices[choiceIdx]) { replyText = 'Invalid choice.'; return; }
    const choice = event.choices[choiceIdx];
    const roll = 1 + run.rng.int(20);
    const outcome = resolveRoll(choice, roll);
    run.currentRoom.resolved = true;

    const ctx = { chooserId: userId, party: run.party };
    const effects = outcome.effects(ctx) || [];

    // Process "special" effects (grant_relic, grant_item, pot_add/sub, spawn_combat)
    const combatEffects = [];
    for (const eff of effects) {
      if (eff.kind === 'grant_relic') {
        const relic = loot.rollRelicDrop(run.rng, eff.rarityBias || 1, run.dungeonId || 'spoiled_vault');
        if (!run.relics.includes(relic.key)) {
          run.relics.push(relic.key);
          run.log.push(`🏺 Relic acquired: **${relic.name}**`);
        } else {
          run.pot += 200;
          run.log.push(`🏺 Duplicate relic converted to 200 🥛`);
        }
      } else if (eff.kind === 'grant_item') {
        const target = run.party.find(p => p.userId === eff.target) || run.party.find(p => p.userId === userId);
        if (!target) continue;
        let item;
        if (eff.item === 'random') item = loot.rollConsumableDrop(run.rng);
        else item = loot.getConsumable(eff.item);
        if (item) {
          target.items.push(item.key);
          run.log.push(`🎒 ${target.username} got ${item.name}`);
        }
      } else if (eff.kind === 'pot_add') {
        run.pot += eff.amount;
        run.log.push(`💰 +${eff.amount} to pot`);
      } else if (eff.kind === 'pot_sub') {
        run.pot = Math.max(0, run.pot - eff.amount);
        run.log.push(`💸 -${eff.amount} from pot`);
      } else if (eff.kind === 'spawn_combat') {
        spawnCombatKeys = eff.enemies;
      } else {
        combatEffects.push(eff);
      }
    }
    const logs = combat.processEffects(run, combatEffects, `Event:${event.title}`, run.rng);
    run.log.push(`🎲 Rolled **${roll}** — ${outcome.text}`, ...logs);
    state.markDirty(run);

    if (spawnCombatKeys) {
      // Convert room to combat with these enemies
      combat.startCombat(run, spawnCombatKeys);
      state.markDirty(run);
    } else {
      shouldAdvance = true;
    }
    replyText = `🎲 Rolled ${roll} — ${outcome.text}`;
  });
  await interaction.reply({ content: replyText, flags: 64 });
  const run = state.getRun(runId);
  const thread = await interaction.client.channels.fetch(run.threadId).catch(() => null);
  if (!thread) return;
  if (spawnCombatKeys) {
    await postStatus(run, thread, true);
    setTimeout(() => processTurn(run, thread).catch(() => {}), 1200);
  } else if (shouldAdvance) {
    setTimeout(() => advanceToNextFloor(run, thread).catch(() => {}), 2500);
  }
}

async function handleBuy(interaction, runId, itemIdx) {
  const userId = interaction.user.id;
  let replyText = '';
  await withLock('dun:' + runId, async () => {
    const run = state.getRun(runId);
    if (!run || run.currentRoom?.kind !== 'merchant') { replyText = 'Not in a merchant room.'; return; }
    const room = run.currentRoom;
    const slot = room.items[itemIdx];
    if (!slot) { replyText = 'Invalid item.'; return; }
    if (room.purchased[itemIdx]) { replyText = 'Already bought.'; return; }
    if (run.pot < slot.price) { replyText = `Pot has ${run.pot}, need ${slot.price}.`; return; }
    const player = run.party.find(p => p.userId === userId);
    if (!player) { replyText = "You're not in this run."; return; }
    run.pot -= slot.price;
    room.purchased[itemIdx] = userId;
    player.items.push(slot.item.key);
    state.markDirty(run);
    replyText = `✅ Bought ${slot.item.name}`;
  });
  await interaction.reply({ content: replyText, flags: 64 });
  // Refresh merchant display
  const run = state.getRun(runId);
  const thread = await interaction.client.channels.fetch(run.threadId).catch(() => null);
  if (thread && run.currentRoom?.kind === 'merchant') {
    try {
      const msgs = await thread.messages.fetch({ limit: 10 });
      const merchantMsg = msgs.find(m => m.embeds[0]?.title?.includes('Milk Merchant'));
      if (merchantMsg) await merchantMsg.edit(display.buildMerchantRoom(run));
    } catch {}
  }
}

async function handleLeave(interaction, runId) {
  await interaction.reply({ content: 'Leaving merchant...', flags: 64 });
  const run = state.getRun(runId);
  if (!run) return;
  const thread = await interaction.client.channels.fetch(run.threadId).catch(() => null);
  if (thread) setTimeout(() => advanceToNextFloor(run, thread).catch(() => {}), 800);
}

async function handleCombatEnd(run, thread, end) {
  clearTimeout(run._turnTimer);
  // Clean up the turn prompt message so it doesn't linger after combat.
  if (run._activeTurnMessageId) {
    try {
      const prev = await thread.messages.fetch(run._activeTurnMessageId);
      await prev.delete();
    } catch {}
    run._activeTurnMessageId = null;
  }
  if (!end.victory) {
    return endRun(run, thread, 'defeat');
  }

  // Floor cleared — award per-floor payout and drop loot
  const perFloorBucks = BASE_REWARD_PER_FLOOR;
  for (const p of run.party) {
    if (!p.downed) {
      await payout(p.userId, perFloorBucks, BASE_XP_PER_FLOOR);
    }
  }
  run.log.push(`💰 Each survivor earned ${perFloorBucks} milk bucks + ${BASE_XP_PER_FLOOR} XP`);

  // Loot drops
  const room = run.currentRoom;
  if (room?.guaranteesRelic) {
    const relic = loot.rollRelicDrop(run.rng, 2, run.dungeonId || 'spoiled_vault');
    if (!run.relics.includes(relic.key)) {
      run.relics.push(relic.key);
      run.log.push(`🏺 Elite drop: **${relic.name}** — ${relic.description}`);
    } else {
      run.pot += 300;
      run.log.push(`🏺 Duplicate relic — +300 🥛 to pot`);
    }
    // Hardcore midboss (floor 5 boss room): 25% chance of mythic drop
    if (run.difficulty === 'hardcore' && room.kind === 'boss' && run.floor === 5 && run.rng.chance(0.25)) {
      const mythic = loot.rollMythicDrop(run.rng, run.dungeonId || 'spoiled_vault');
      if (mythic && !run.relics.includes(mythic.key)) {
        run.relics.push(mythic.key);
        run.log.push(`💀 **HARDCORE MYTHIC:** ${mythic.emoji} **${mythic.name}** — *${mythic.description}*`);
      }
    }
  } else if (room?.guaranteesLoot || run.rng.chance(0.25)) {
    // Consumable drop goes to a random living party member
    const living = run.party.filter(p => !p.downed);
    if (living.length > 0) {
      const lucky = living[run.rng.int(living.length)];
      const drop = loot.rollConsumableDrop(run.rng);
      lucky.items.push(drop.key);
      run.log.push(`🎒 ${lucky.username} picked up **${drop.name}**`);
    }
  }
  state.markDirty(run);

  await advanceToNextFloor(run, thread);
}

async function endRun(run, thread, outcome) {
  clearTimeout(run._turnTimer);
  run.state = 'ENDED';
  state.markDirty(run);

  const client = thread.client;
  const noRevives = !run._revivesUsed;
  const deepestFloor = Math.max(run.deepestFloor || 0, run.floor);
  const runDurationMs = Date.now() - (run.createdAt || Date.now());
  const completed = outcome === 'victory';

  let perPlayerBucks = 0;
  let perPlayerXp = 0;

  // Fire run_end relic hooks (e.g., Lactose Tome gives xp_mul)
  combat.fireRelicHooks(run, 'run_end');
  const xpBonus = run._xpMul || 1;

  const hardcoreMul = run.difficulty === 'hardcore' ? 3 : 1;
  if (outcome === 'victory') {
    perPlayerBucks = Math.floor((run.pot / run.party.length) * hardcoreMul);
    perPlayerXp = Math.floor(BASE_XP_PER_FLOOR * run.floor * xpBonus * hardcoreMul);
    for (const p of run.party) {
      await payout(p.userId, perPlayerBucks, perPlayerXp);
    }
    // Class unlocks on completion: floor 10 clear grants the dungeon's final-class unlock
    // AND backfills its floor-5 class in case the player skipped or missed the midboss credit.
    const did = run.dungeonId || 'spoiled_vault';
    const f5Key = classUnlockFor(did, 5);
    const f10Key = classUnlockFor(did, 10);
    for (const p of run.party) {
      state.updateUserStats(p.userId, s => {
        if (f10Key && !s.classUnlocks.includes(f10Key)) s.classUnlocks.push(f10Key);
        if (f5Key && !s.classUnlocks.includes(f5Key)) s.classUnlocks.push(f5Key);
        // 3rd-ability unlock for whichever class they played
        if (!s.abilityUnlocks) s.abilityUnlocks = [];
        const key = `${p.classKey}_3`;
        if (!s.abilityUnlocks.includes(key)) s.abilityUnlocks.push(key);
      });
    }

    // Hardcore rewards: mythic relic drop from the final boss, track hardcore stats
    if (run.difficulty === 'hardcore') {
      const mythic = loot.rollMythicDrop(run.rng, run.dungeonId || 'spoiled_vault');
      if (mythic) {
        for (const p of run.party) {
          state.updateUserStats(p.userId, s => {
            s.mythicsCollected = s.mythicsCollected || [];
            if (!s.mythicsCollected.includes(mythic.key)) s.mythicsCollected.push(mythic.key);
            s.hardcoreCompletions = (s.hardcoreCompletions || 0) + 1;
          });
        }
        run.log.push(`💀 **HARDCORE MYTHIC DROP:** ${mythic.emoji} **${mythic.name}** — *${mythic.description}*`);
      }
    }
    await thread.send(display.buildVictoryEmbed(run, { perPlayerBucks, perPlayerXp })).catch(() => {});
  } else {
    await thread.send(display.buildDefeatEmbed(run)).catch(() => {});
  }

  // Update meta-stats for each player
  for (const p of run.party) {
    state.updateUserStats(p.userId, s => {
      s.totalRuns += 1;
      if (completed) {
        s.completions += 1;
        // Per-dungeon completion tracking gates the next dungeon's unlock.
        if (!s.completionsByDungeon) s.completionsByDungeon = {};
        const did = run.dungeonId || 'spoiled_vault';
        s.completionsByDungeon[did] = (s.completionsByDungeon[did] || 0) + 1;
      }
      if (run.difficulty === 'hardcore') {
        if (completed) s.hardcoreCompletions = (s.hardcoreCompletions || 0) + 1;
        if (deepestFloor > (s.hardcoreDeepestFloor || 0)) s.hardcoreDeepestFloor = deepestFloor;
      }
      if (deepestFloor > (s.deepestFloor || 0)) s.deepestFloor = deepestFloor;
      if (completed && (!s.fastestRunMs || runDurationMs < s.fastestRunMs)) s.fastestRunMs = runDurationMs;
      // Track favorite class by counting runs per class
      if (!s.classCounts) s.classCounts = {};
      s.classCounts[p.classKey] = (s.classCounts[p.classKey] || 0) + 1;
      s.favClass = Object.entries(s.classCounts).sort((a, b) => b[1] - a[1])[0][0];
      // Record last 10 runs
      s.last10Runs = [{ date: new Date().toISOString().slice(0, 10), class: p.classKey, floor: deepestFloor, completed, durationMs: runDurationMs }, ...(s.last10Runs || [])].slice(0, 10);
      // Track relics seen
      for (const r of run.relics || []) {
        if (!s.relicsSeen.includes(r)) s.relicsSeen.push(r);
      }
    });
  }

  // (Run-end embed stays inside the thread — do NOT cross-post to #milkbot-games.)

  // Fire achievements (use thread as channel so announcements land in the thread)
  for (const p of run.party) {
    try {
      require('../achievements').check(p.userId, p.username, 'dungeon_run_end', {
        deepestFloor,
        completed,
        partySize: run.party.length,
        noRevives,
      }, thread);
      if (completed && deepestFloor >= FINAL_FLOOR) {
        require('../achievements').check(p.userId, p.username, 'dungeon_curdfather_kill', {}, thread);
      }
    } catch (e) { console.warn('[dungeon] achievement check failed:', e.message); }
  }

  // Archive thread
  try { await thread.setArchived(true, 'run ended'); } catch {}

  state.deleteRun(run.runId);
  state.flushActiveRunsNow();

  setTimeout(() => refreshLobby(client).catch(() => {}), 500);
}

async function handleAbandon(interaction, runId) {
  const userId = interaction.user.id;
  const run = state.getRun(runId);
  if (!run) return interaction.reply({ content: 'Run not found.', flags: 64 });
  if (!run.party.some(p => p.userId === userId)) return interaction.reply({ content: "You're not in this run.", flags: 64 });
  await interaction.reply({ content: '🏳️ Abandoning run...', flags: 64 });

  // Refund 50% of entry cost per player as consolation
  for (const p of run.party) {
    await payout(p.userId, Math.floor(ENTRY_COST * 0.5), 0);
  }
  run.log.push(`🏳️ ${interaction.user.username} abandoned the run. 50% entry refunded.`);

  const thread = await interaction.client.channels.fetch(run.threadId).catch(() => null);
  if (thread) await endRun(run, thread, 'defeat');
}

async function handleStats(interaction) {
  const userId = interaction.user.id;
  const stats = state.getUserStats(userId);
  const embed = new EmbedBuilder()
    .setColor(0x3F51B5)
    .setTitle(`📜 ${interaction.user.username}'s Dungeon Stats`)
    .addFields(
      { name: 'Total runs', value: `${stats.totalRuns}`, inline: true },
      { name: 'Completions', value: `${stats.completions}`, inline: true },
      { name: 'Deepest floor', value: `${stats.deepestFloor}`, inline: true },
      { name: 'Classes unlocked', value: stats.classUnlocks.join(', ') || 'none', inline: false },
    );
  await interaction.reply({ embeds: [embed], flags: 64 });
}

// Called by dungeon/index.js after restoreActiveRuns to re-prompt the active
// player's turn. The previous turn's button message was deleted on shutdown
// (and _activeTurnMessageId isn't persisted), so without this the run stalls.
async function resumePlayingRun(run, thread) {
  if (run.state !== 'PLAYING') return;
  // Re-post the status embed so the thread shows current state.
  await postStatus(run, thread, true).catch(() => {});
  // If we're mid-combat, re-issue the current turn prompt.
  if (run.currentRoom && (run.currentRoom.kind === 'combat' || run.currentRoom.kind === 'elite' || run.currentRoom.kind === 'boss')) {
    await processTurn(run, thread).catch(e => console.warn('[dungeon] resume processTurn failed:', e.message));
  }
}

module.exports = {
  name: 'dun',
  description: 'MilkBot Dungeon — form a party and descend into the Spoiled Vault',
  slashOptions: [],
  execute,
  executeSlash,
  handleButtonInteraction,
  refreshChannelPanels,
  resumePlayingRun,
};
