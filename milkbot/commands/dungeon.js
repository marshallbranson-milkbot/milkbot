// Dungeon command — entry command + full game-loop orchestration.
// Big file on purpose; mirrors existing pattern (see bjt.js, raidboss.js).

const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { withLock } = require('../balancelock');
const dungeon = require('../dungeon');
const { state, combat, rooms, display, classes } = dungeon;

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
  // Fetch recent messages to find our existing panels
  let explainerMsg = null, lobbyMsg = null;
  try {
    const recent = await channel.messages.fetch({ limit: 50 });
    for (const m of recent.values()) {
      if (m.author.id !== client.user.id || !m.embeds.length) continue;
      const title = m.embeds[0].title || '';
      if (title.includes('The Spoiled Vault')) explainerMsg = m;
      if (title.includes('Dungeon Lobby')) lobbyMsg = m;
    }
  } catch (e) {
    console.warn('[dungeon] fetch panels failed:', e.message);
  }

  const explainerPayload = display.buildExplainerEmbed();
  if (explainerMsg) await explainerMsg.edit(explainerPayload).catch(() => {});
  else explainerMsg = await channel.send(explainerPayload).catch(() => null);

  const lobbyPayload = display.buildLobbyPanel(state.allRuns());
  if (lobbyMsg) await lobbyMsg.edit(lobbyPayload).catch(() => {});
  else lobbyMsg = await channel.send(lobbyPayload).catch(() => null);

  channelPanels.set(channel.guildId, {
    channelId: channel.id,
    explainerId: explainerMsg?.id,
    lobbyId: lobbyMsg?.id,
  });
}

async function refreshLobby(client) {
  for (const [guildId, panel] of channelPanels) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    const channel = guild.channels.cache.get(panel.channelId);
    if (!channel || !panel.lobbyId) continue;
    try {
      const msg = await channel.messages.fetch(panel.lobbyId);
      await msg.edit(display.buildLobbyPanel(state.allRuns()));
    } catch (e) { /* next refresh will retry */ }
  }
}

// ========= Thread creation =========

async function createDungeonThread(channel, creatorName, runId) {
  // Prefer private thread. Fall back to public if guild lacks Community features.
  const privateAllowed = channel.guild.features.includes('COMMUNITY');
  const threadName = `${creatorName}'s Descent — ${runId.slice(0, 6)}`;
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
    if (id === 'dun_start') return handleStart(interaction);
    if (id === 'dun_stats') return handleStats(interaction);
    if (id.startsWith('dun_join_')) return handleJoin(interaction, id.slice('dun_join_'.length));
    if (id.startsWith('dun_pick_')) {
      const [_dun, _pick, runId, classKey] = id.split('_');
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
  } catch (e) {
    console.error('[dungeon] interaction error:', e);
    try { await interaction.reply({ content: `⚠️ Something went wrong: ${e.message}`, flags: 64 }); } catch {}
  }
}

async function handleStart(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.globalName || interaction.user.username;

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

  // Post class picker in thread
  await thread.send(display.buildClassPicker(run, userId));
  await thread.send({ content: `Party forming — **${run.party.length}/${run.maxPartySize}**. Waiting for others to join from #milkbot-dungeon. When everyone's picked a class, the descent begins.` });

  await interaction.editReply({ content: `🏰 Your descent is ready: <#${thread.id}>` });
  await refreshLobby(interaction.client);
}

async function handleJoin(interaction, runId) {
  const userId = interaction.user.id;
  const username = interaction.user.globalName || interaction.user.username;

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
      await thread.send(display.buildClassPicker(run, userId));
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

function makePartySlot(userId, username) {
  return { userId, username, classKey: null, hp: 0, maxHp: 0, atk: 0, def: 0, spd: 0, statuses: [], cooldowns: {}, items: [], buffs: [], downed: false, defending: false };
}

// ========= Game loop =========

async function beginFloor(run, thread) {
  const room = rooms.generateRoom(run);
  combat.startCombat(run, room.enemyKeys);
  state.markDirty(run);

  // Post/refresh status embed
  await postStatus(run, thread, true);
  await thread.send({ content: `⬇️ **Floor ${run.floor}** begins.` }).catch(() => {});
  await processTurn(run, thread);
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
  await postStatus(run, thread);
  // Mention the active player; their action buttons will come via ephemeral reply when they click any button.
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dun_atk_${run.runId}`).setLabel('Attack').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
  );
  // We post a public turn-prompt that anyone could click. Inside the handler we check identity.
  const cls = classes.getClass(player.classKey);
  const prompt = `<@${player.userId}> — **${cls.name}** turn. Click your action buttons below.`;
  const components = display.buildTurnActions(run, player).components;
  try {
    const msg = await thread.send({ content: prompt, components });
    run._activeTurnMessageId = msg.id;
    state.markDirty(run);
  } catch (e) { console.warn('[dungeon] turn prompt failed:', e.message); }

  // Set timeout to auto-attack
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
  // Slice 2 wires actual item UI. For now, inform.
  await interaction.reply({ content: 'Items arrive in slice 2 🥛', flags: 64 });
}

async function handleCombatEnd(run, thread, end) {
  clearTimeout(run._turnTimer);
  if (!end.victory) {
    return endRun(run, thread, 'defeat');
  }

  // Floor cleared — advance
  const perFloorBucks = BASE_REWARD_PER_FLOOR;
  for (const p of run.party) {
    if (!p.downed) {
      await payout(p.userId, perFloorBucks, BASE_XP_PER_FLOOR);
    }
  }
  run.log.push(`💰 Each survivor earned ${perFloorBucks} milk bucks + ${BASE_XP_PER_FLOOR} XP`);

  if (run.floor >= FINAL_FLOOR) {
    return endRun(run, thread, 'victory');
  }

  run.floor += 1;
  // Auto-revive solo deaths at 50% HP between floors
  for (const p of run.party) {
    if (p.downed) {
      p.downed = false;
      p.hp = Math.floor(p.maxHp * 0.5);
      run.log.push(`🌱 ${p.username} stands back up at ${p.hp}/${p.maxHp} HP`);
    }
  }
  state.markDirty(run);
  await thread.send(display.buildFloorClearedEmbed(run)).catch(() => {});
  setTimeout(() => beginFloor(run, thread).catch(() => {}), 1500);
}

async function endRun(run, thread, outcome) {
  clearTimeout(run._turnTimer);
  run.state = 'ENDED';
  state.markDirty(run);

  if (outcome === 'victory') {
    // Split remaining pot equally among all party
    const perPlayerBucks = Math.floor(run.pot / run.party.length);
    const perPlayerXp = BASE_XP_PER_FLOOR * run.floor;
    for (const p of run.party) {
      await payout(p.userId, perPlayerBucks, perPlayerXp);
    }
    await thread.send(display.buildVictoryEmbed(run, { perPlayerBucks, perPlayerXp })).catch(() => {});
  } else {
    // Defeat — jackpot drain 5% of pot, rest absorbed
    await thread.send(display.buildDefeatEmbed(run)).catch(() => {});
  }

  // Archive thread
  try { await thread.setArchived(true, 'run ended'); } catch {}

  state.deleteRun(run.runId);
  state.flushActiveRunsNow();

  // Refresh lobby panel in channel
  const client = thread.client;
  setTimeout(() => refreshLobby(client).catch(() => {}), 500);
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

module.exports = {
  name: 'dun',
  description: 'MilkBot Dungeon — form a party and descend into the Spoiled Vault',
  slashOptions: [],
  execute,
  executeSlash,
  handleButtonInteraction,
  refreshChannelPanels,
};
