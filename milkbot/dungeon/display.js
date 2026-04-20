// Embed builders for the dungeon UX.
// Each function returns a payload suitable for channel.send() or message.edit().

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { listClasses, getClass } = require('./classes');
const { getConsumable, getRelic } = require('./loot');

// ─── Visual helpers ─────────────────────────────────────────────────────────

function hpBar(current, max, width = 10) {
  if (current <= 0) return '░'.repeat(width);
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.max(1, Math.round(pct * width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function centerInWidth(s, width) {
  const len = [...s].length;
  if (len >= width) return s;
  const pad = width - len;
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + s + ' '.repeat(pad - left);
}

// Build a visual scene showing the party on top and enemies below, separated by an attack-line.
function buildCombatScene(run, titleLine) {
  const partyEmojis = run.party.map(p => p.downed ? '💀' : (getClass(p.classKey)?.emoji || '❔'));
  const enemyEmojis = (run.currentRoom?.enemies || []).filter(e => e.hp > 0).map(e => e.emoji);
  const SCENE_WIDTH = 32;

  const lines = [];
  lines.push('╔══════════════════════════════╗');
  lines.push('║' + centerInWidth(titleLine, 30) + '║');
  lines.push('╚══════════════════════════════╝');
  lines.push('');
  lines.push(centerInWidth(partyEmojis.join('  '), SCENE_WIDTH));
  lines.push('');
  lines.push(centerInWidth('⚡ ⚡ ⚡', SCENE_WIDTH));
  lines.push('');
  lines.push(centerInWidth(enemyEmojis.join('  ') || '(empty)', SCENE_WIDTH));
  return '```\n' + lines.join('\n') + '\n```';
}

function buildBossScene(run, titleLine, subtitleLine) {
  const partyEmojis = run.party.map(p => p.downed ? '💀' : (getClass(p.classKey)?.emoji || '❔'));
  const boss = (run.currentRoom?.enemies || []).find(e => e.isBoss) || run.currentRoom?.enemies?.[0];
  const SCENE_WIDTH = 32;
  const lines = [];
  lines.push('╔══════════════════════════════╗');
  lines.push('║' + centerInWidth(titleLine, 30) + '║');
  if (subtitleLine) lines.push('║' + centerInWidth(subtitleLine, 30) + '║');
  lines.push('╚══════════════════════════════╝');
  lines.push('');
  lines.push(centerInWidth(partyEmojis.join('  '), SCENE_WIDTH));
  lines.push('');
  lines.push(centerInWidth('⚡⚡⚡', SCENE_WIDTH));
  lines.push('');
  lines.push(centerInWidth(boss ? boss.emoji : '???', SCENE_WIDTH));
  lines.push(centerInWidth(`[ ${boss?.name || 'BOSS'} ]`, SCENE_WIDTH));
  return '```\n' + lines.join('\n') + '\n```';
}

function buildRoomBanner(emoji, label) {
  const lines = [];
  lines.push('╔══════════════════════════════╗');
  lines.push('║' + centerInWidth(`${emoji}  ${label}  ${emoji}`, 30) + '║');
  lines.push('╚══════════════════════════════╝');
  return '```\n' + lines.join('\n') + '\n```';
}

function buildRestScene(run) {
  const partyEmojis = run.party.map(p => p.downed ? '💀' : (getClass(p.classKey)?.emoji || '❔'));
  const SCENE_WIDTH = 32;
  const arranged = [];
  // Put fire in the middle
  const half = Math.floor(partyEmojis.length / 2);
  const left = partyEmojis.slice(0, half);
  const right = partyEmojis.slice(half);
  const row = [...left, '🔥', ...right].join('  ');
  arranged.push(centerInWidth(row, SCENE_WIDTH));
  arranged.push(centerInWidth('(resting by the fire)', SCENE_WIDTH));
  return '```\n' +
    '╔══════════════════════════════╗\n' +
    '║' + centerInWidth('🏕️  REST STOP  🏕️', 30) + '║\n' +
    '╚══════════════════════════════╝\n' +
    '\n' +
    arranged.join('\n') + '\n' +
    '```';
}

function partyStatusLines(run) {
  return run.party.map(p => {
    const cls = getClass(p.classKey);
    const emoji = p.downed ? '💀' : (cls?.emoji || '❔');
    if (p.downed) return `${emoji} **${p.username}** — CURDLED`;
    const bar = hpBar(p.hp, p.maxHp);
    const statuses = p.statuses && p.statuses.length ? ` *[${p.statuses.map(s => s.key).join(', ')}]*` : '';
    return `${emoji} **${p.username}** \`${bar}\` ${p.hp}/${p.maxHp}${statuses}`;
  }).join('\n');
}

function enemyStatusLines(run) {
  const enemies = (run.currentRoom?.enemies || []).filter(e => e.hp > 0);
  if (enemies.length === 0) return '*none standing*';
  return enemies.map(e => {
    const bar = hpBar(e.hp, e.maxHp);
    const statuses = e.statuses && e.statuses.length ? ` *[${e.statuses.map(s => s.key).join(', ')}]*` : '';
    return `${e.emoji} **${e.name}** \`${bar}\` ${e.hp}/${e.maxHp}${statuses}`;
  }).join('\n');
}

const COLOR_LOBBY = 0xF5F5DC;        // beige
const COLOR_COMBAT = 0xD32F2F;       // red
const COLOR_VICTORY = 0x4CAF50;      // green
const COLOR_DEFEAT = 0x455A64;       // slate
const COLOR_INFO = 0x3F51B5;         // indigo

// === Channel top: pinned game explainer ===

function buildExplainerEmbed() {
  const embed = new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle('🏰 MilkBot Dungeon — The Spoiled Vault')
    .setDescription(
      'Descend into the Spoiled Vault with up to 3 friends. Beat 10 floors of curdled horrors to reclaim the stolen milk bucks.\n\n' +
      '**Entry:** 1,000 milk bucks per player (pooled into the reward pot)\n' +
      '**Rewards:** milk bucks, XP, rare relics, achievements, and bragging rights\n' +
      '**Death:** get curdled at 0 HP — teammates can revive. Party wipe ends the run.'
    )
    .addFields(
      {
        name: 'Classes',
        value: listClasses().map(c => `${c.emoji} **${c.name}** — ${c.role}${c.unlockedByDefault ? '' : ' *(locked)*'}`).join('\n'),
      },
      {
        name: 'How to play',
        value: 'Click **🏰 Start a Run** below to create a party. Others can click **Join** on any active party. When full (or you click Begin), a private thread opens and the descent begins.',
      },
    )
    .setFooter({ text: 'MilkBot Dungeon v1 • runs take 20-45 minutes • the milk is NEVER safe' });
  return { embeds: [embed] };
}

// === Channel bottom: start/stats buttons + active parties list ===

function buildLobbyPanel(activeRuns) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_LOBBY)
    .setTitle('🥛 Dungeon Lobby')
    .setDescription(
      activeRuns.length === 0
        ? '*No active runs right now. Be the first to descend.*'
        : activeRuns.map(r => {
            const fill = `${r.party.length}/${r.maxPartySize}`;
            const stateLabel = r.state === 'LOBBY' ? 'forming' : r.state === 'PLAYING' ? `floor ${r.floor}` : r.state.toLowerCase();
            return `• **${r.creatorName}'s Run** — ${fill} — ${stateLabel}`;
          }).join('\n'),
    );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dun_start').setLabel('Start a Run').setEmoji('🏰').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dun_stats').setLabel('Your Stats').setEmoji('📜').setStyle(ButtonStyle.Secondary),
  );

  // Join buttons for parties still in LOBBY with room
  const joinable = activeRuns.filter(r => r.state === 'LOBBY' && r.party.length < r.maxPartySize).slice(0, 4);
  const components = [actionRow];
  if (joinable.length > 0) {
    const joinRow = new ActionRowBuilder().addComponents(
      ...joinable.map(r =>
        new ButtonBuilder()
          .setCustomId(`dun_join_${r.runId}`)
          .setLabel(`Join ${r.creatorName}'s Run`)
          .setEmoji('➕')
          .setStyle(ButtonStyle.Success)
      ),
    );
    components.push(joinRow);
  }

  return { embeds: [embed], components };
}

// === Inside thread: class picker ===

function buildClassPicker(run, userId) {
  const picked = run.party.find(p => p.userId === userId)?.classKey;
  const embed = new EmbedBuilder()
    .setColor(COLOR_LOBBY)
    .setTitle('🎭 Pick Your Class')
    .setDescription(
      picked
        ? `You picked **${getClass(picked).name}**. Waiting for others.`
        : 'Choose one. Class locks in the moment you click — no take-backs.',
    )
    .addFields(
      ...listClasses().map(cls => ({
        name: `${cls.emoji} ${cls.name} — ${cls.role}${cls.unlockedByDefault ? '' : ' 🔒'}`,
        value:
          `*${cls.description}*\n` +
          `HP ${cls.base.hp} · ATK ${cls.base.atk} · DEF ${cls.base.def} · SPD ${cls.base.spd}\n` +
          cls.abilities.map(a => `• **${a.name}** (cd ${a.cooldown || 1}) — ${a.description}`).join('\n'),
      })),
    );

  // One button per class, 4 per row
  const rows = [];
  let currentRow = new ActionRowBuilder();
  for (const cls of listClasses()) {
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`dun_pick_${run.runId}_${cls.key}`)
        .setLabel(cls.name)
        .setEmoji(cls.emoji)
        .setStyle(picked === cls.key ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(!!picked || !cls.unlockedByDefault),
    );
  }
  rows.push(currentRow);
  return { embeds: [embed], components: rows };
}

// === Persistent party status embed (top of thread, edited each turn) ===

function buildStatusEmbed(run) {
  const roomKind = run.currentRoom?.kind || 'exploring';
  const isBoss = roomKind === 'boss' || (run.currentRoom?.enemies || []).some(e => e.isBoss);
  const isCombat = roomKind === 'combat' || roomKind === 'elite' || isBoss;

  const embed = new EmbedBuilder()
    .setColor(isBoss ? 0x8B0000 : COLOR_COMBAT)
    .setTitle(`🏰 The Spoiled Vault — Floor ${run.floor}`);

  if (isCombat) {
    const titleLine = isBoss
      ? `🔥  BOSS FLOOR  🔥`
      : roomKind === 'elite' ? `⚠️  ELITE — FLOOR ${run.floor}  ⚠️`
      : `⚔️  FLOOR ${run.floor} · COMBAT  ⚔️`;
    const subtitleLine = isBoss ? (run.currentRoom?.enemies?.[0]?.name || '') : null;
    const scene = isBoss ? buildBossScene(run, titleLine, subtitleLine) : buildCombatScene(run, titleLine);
    embed.setDescription(scene);
    embed.addFields(
      { name: '👥 Party', value: partyStatusLines(run), inline: false },
      { name: '👹 Enemies', value: enemyStatusLines(run), inline: false },
    );
  } else {
    embed.setDescription(buildRoomBanner('🏰', `FLOOR ${run.floor}`));
    embed.addFields({ name: '👥 Party', value: partyStatusLines(run), inline: false });
  }

  const relicsField = run.relics && run.relics.length
    ? run.relics.map(k => {
        const r = getRelic(k);
        return r ? `${r.emoji} ${r.name}` : `❔ ${k}`;
      }).join('\n')
    : '*none*';

  embed.addFields(
    { name: '🏺 Relics', value: relicsField, inline: true },
    { name: '💰 Pot', value: `${run.pot.toLocaleString()} 🥛`, inline: true },
  );
  if (run.log && run.log.length) {
    embed.addFields({ name: '📜 Recent', value: run.log.slice(-5).join('\n').slice(0, 1024) });
  }
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dun_abandon_${run.runId}`).setLabel('Abandon Run').setEmoji('🏳️').setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row] };
}

// === Turn buttons (ephemeral, shown to the active player) ===

function buildTurnActions(run, player) {
  const cls = getClass(player.classKey);
  const a1 = cls.abilities[0];
  const a2 = cls.abilities[1];
  const cd1 = player.cooldowns[a1.key] || 0;
  const cd2 = player.cooldowns[a2.key] || 0;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dun_atk_${run.runId}`).setLabel('Attack').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dun_abi_${run.runId}_${a1.key}`)
      .setLabel(cd1 ? `${a1.name} (${cd1})` : a1.name)
      .setEmoji(cls.emoji)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!!cd1),
    new ButtonBuilder()
      .setCustomId(`dun_abi_${run.runId}_${a2.key}`)
      .setLabel(cd2 ? `${a2.name} (${cd2})` : a2.name)
      .setEmoji(cls.emoji)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!!cd2),
    new ButtonBuilder().setCustomId(`dun_def_${run.runId}`).setLabel('Defend').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dun_item_${run.runId}`)
      .setLabel(`Items (${player.items?.length || 0})`)
      .setEmoji('🎒')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!player.items || player.items.length === 0),
  );
  const embed = new EmbedBuilder()
    .setColor(COLOR_COMBAT)
    .setTitle(`${cls.emoji} ${player.username}'s turn — ${cls.name}`)
    .setDescription(
      `**${player.hp}/${player.maxHp} HP** · 90s to act.\n\n` +
      `⚔️ **Attack** — basic hit (ATK ${player.atk})\n` +
      `${cls.emoji} **${a1.name}** — ${a1.description}\n` +
      `${cls.emoji} **${a2.name}** — ${a2.description}\n` +
      `🛡️ **Defend** — halve next incoming damage`,
    );
  return { embeds: [embed], components: [row1, row2] };
}

// === Run-end embeds ===

function buildVictoryEmbed(run, rewards) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_VICTORY)
    .setTitle('🏆 VICTORY — The Curdfather falls!')
    .setDescription(`The party cleared all ${run.floor} floors of the Spoiled Vault.`)
    .addFields(
      { name: 'Survivors', value: run.party.filter(p => !p.downed).map(p => `${getClass(p.classKey)?.emoji || '❔'} ${p.username}`).join('\n') || '*none*', inline: true },
      { name: 'Milk Bucks', value: `+${rewards.perPlayerBucks.toLocaleString()} each`, inline: true },
      { name: 'XP', value: `+${rewards.perPlayerXp.toLocaleString()} each`, inline: true },
    );
  return { embeds: [embed] };
}

function buildDefeatEmbed(run) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_DEFEAT)
    .setTitle('💀 Party Wipe — The Vault wins this round.')
    .setDescription(`The party fell on floor ${run.floor}. The milk bucks stay with the rot.`)
    .addFields(
      { name: 'Fallen', value: run.party.map(p => `${getClass(p.classKey)?.emoji || '❔'} ${p.username}`).join('\n'), inline: true },
      { name: 'Deepest floor', value: `${run.floor}`, inline: true },
    );
  return { embeds: [embed] };
}

function buildFloorClearedEmbed(run) {
  const scene = '```\n' +
    '╔══════════════════════════════╗\n' +
    '║' + centerInWidth(`✅  FLOOR ${run.floor} CLEARED  ✅`, 30) + '║\n' +
    '╚══════════════════════════════╝\n' +
    '```';
  const embed = new EmbedBuilder()
    .setColor(COLOR_VICTORY)
    .setTitle(`✅ Floor ${run.floor} cleared`)
    .setDescription(scene + '\nMoving to the next floor. The rot runs deeper.');
  return { embeds: [embed] };
}

// === Treasure room ===

function buildTreasureRoom(run) {
  const room = run.currentRoom;
  const chestRow = room.chests.map((c, i) => {
    const claimed = Object.values(room.claimed).includes(i);
    return claimed ? '🗃️' : '📦';
  }).join('    ');
  const SCENE_WIDTH = 32;
  const scene = '```\n' +
    '╔══════════════════════════════╗\n' +
    '║' + centerInWidth('💰  TREASURE ROOM  💰', 30) + '║\n' +
    '╚══════════════════════════════╝\n' +
    '\n' +
    centerInWidth(chestRow, SCENE_WIDTH) + '\n' +
    centerInWidth(room.chests.map((_, i) => `#${i + 1}`).join('      '), SCENE_WIDTH) + '\n' +
    '```';
  const desc = room.chests.map((c, i) => {
    const claimedBy = Object.entries(room.claimed).find(([uid, idx]) => idx === i);
    if (claimedBy) {
      const user = run.party.find(p => p.userId === claimedBy[0]);
      return `**Chest ${i + 1}** — *claimed by ${user?.username || '?'}*`;
    }
    return `**Chest ${i + 1}** — ???`;
  }).join('\n');
  const embed = new EmbedBuilder()
    .setColor(0xFFC107)
    .setTitle(`💰 Treasure Room — Floor ${run.floor}`)
    .setDescription(scene + '\nThree chests. Each party member picks one.')
    .addFields({ name: 'Status', value: desc });
  const row = new ActionRowBuilder().addComponents(
    ...room.chests.map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`dun_chest_${run.runId}_${i}`)
        .setLabel(`Chest ${i + 1}`)
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Primary)
    ),
  );
  return { embeds: [embed], components: [row] };
}

// === Event room ===

function buildEventRoom(run, event) {
  // A themed icon per event (falls back to scroll)
  const iconByKey = {
    expired_bottle: '🍼', rusted_fridge: '🧊', milkmaid_ghost: '👻', cheese_vendor: '🧀',
    shrine_of_curd: '🕯️', trapped_chest: '📦', dreaming_wraith: '😴', runic_vat: '🫙',
    starved_calf: '🐄', crossroads: '🛤️', broken_bottle: '🍾', ancient_churner: '🗿',
    sour_spring: '💧', phantom_cow: '🐮', lost_traveler: '🧳',
  };
  const icon = iconByKey[event.key] || '📜';
  const scene = '```\n' +
    '╔══════════════════════════════╗\n' +
    '║' + centerInWidth('📜  ENCOUNTER  📜', 30) + '║\n' +
    '╚══════════════════════════════╝\n' +
    '\n' +
    centerInWidth(icon, 32) + '\n' +
    centerInWidth(event.title, 32) + '\n' +
    '```';
  const embed = new EmbedBuilder()
    .setColor(0x9C27B0)
    .setTitle(`📜 ${event.title}`)
    .setDescription(scene + '\n' + event.description);
  const row = new ActionRowBuilder().addComponents(
    ...event.choices.map((c, i) =>
      new ButtonBuilder()
        .setCustomId(`dun_evc_${run.runId}_${i}`)
        .setLabel(c.label)
        .setEmoji(c.emoji || '▶️')
        .setStyle(ButtonStyle.Secondary)
    ),
  );
  return { embeds: [embed], components: [row] };
}

// === Merchant room ===

function buildMerchantRoom(run) {
  const room = run.currentRoom;
  const scene = '```\n' +
    '╔══════════════════════════════╗\n' +
    '║' + centerInWidth('🛒  MERCHANT  🛒', 30) + '║\n' +
    '╚══════════════════════════════╝\n' +
    '\n' +
    centerInWidth('🧙', 32) + '\n' +
    centerInWidth('[ 5 wares on offer ]', 32) + '\n' +
    '```';
  const desc = room.items.map((slot, i) => {
    const bought = room.purchased[i];
    if (bought) return `~~${slot.item.emoji} ${slot.item.name} — ${slot.price}🥛~~ *(bought)*`;
    return `${slot.item.emoji} **${slot.item.name}** — ${slot.price}🥛 — *${slot.item.description}*`;
  }).join('\n');
  const embed = new EmbedBuilder()
    .setColor(0x795548)
    .setTitle(`🛒 Milk Merchant — Floor ${run.floor}`)
    .setDescription(`${scene}\n**Pot: ${run.pot.toLocaleString()}** 🥛\n\n${desc}\n\nClick an item to buy. **Leave** when done.`);
  const buyRow = new ActionRowBuilder().addComponents(
    ...room.items.map((slot, i) =>
      new ButtonBuilder()
        .setCustomId(`dun_buy_${run.runId}_${i}`)
        .setLabel(`${slot.price}🥛`)
        .setEmoji(slot.item.emoji)
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!room.purchased[i])
    ),
  );
  const leaveRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dun_leave_${run.runId}`).setLabel('Leave merchant').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [buyRow, leaveRow] };
}

// === Rest room ===

function buildRestRoom(run, healedAmount) {
  const scene = buildRestScene(run);
  const embed = new EmbedBuilder()
    .setColor(0x00BCD4)
    .setTitle(`🏕️ Rest Stop — Floor ${run.floor}`)
    .setDescription(`${scene}\nThe party rests. Everyone recovers **${healedAmount} HP**.`)
    .addFields({ name: '👥 Party', value: partyStatusLines(run) });
  return { embeds: [embed] };
}

// === Item picker (ephemeral, player's inventory) ===

function buildItemPicker(run, player, consumablesByKey) {
  if (!player.items || player.items.length === 0) {
    return { content: "You have no items.", flags: 64 };
  }
  const desc = player.items.map((key, i) => {
    const c = consumablesByKey[key];
    return `**${i + 1}.** ${c?.emoji || '❓'} **${c?.name || key}** — ${c?.description || '(unknown)'}`;
  }).join('\n');
  const embed = new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle('🎒 Your items')
    .setDescription(desc);
  const rows = [];
  let row = new ActionRowBuilder();
  for (let i = 0; i < player.items.length; i++) {
    if (row.components.length === 5) { rows.push(row); row = new ActionRowBuilder(); }
    const c = consumablesByKey[player.items[i]];
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`dun_useitem_${run.runId}_${i}`)
        .setLabel(`${i + 1}. ${c?.name || player.items[i]}`.slice(0, 80))
        .setEmoji(c?.emoji || '❓')
        .setStyle(ButtonStyle.Primary)
    );
  }
  if (row.components.length > 0) rows.push(row);
  return { embeds: [embed], components: rows, flags: 64 };
}

module.exports = {
  buildExplainerEmbed,
  buildLobbyPanel,
  buildClassPicker,
  buildStatusEmbed,
  buildTurnActions,
  buildVictoryEmbed,
  buildDefeatEmbed,
  buildFloorClearedEmbed,
  buildTreasureRoom,
  buildEventRoom,
  buildMerchantRoom,
  buildRestRoom,
  buildItemPicker,
};
