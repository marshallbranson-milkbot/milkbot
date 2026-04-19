// Embed builders for the dungeon UX.
// Each function returns a payload suitable for channel.send() or message.edit().

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { listClasses, getClass } = require('./classes');
const { getConsumable, getRelic } = require('./loot');

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
  const partyField = run.party.map(p => {
    const cls = getClass(p.classKey);
    const hp = p.downed ? '💀 Curdled' : `${p.hp}/${p.maxHp} HP`;
    const statuses = p.statuses && p.statuses.length ? ` [${p.statuses.map(s => s.key).join(', ')}]` : '';
    return `${cls?.emoji || '❔'} **${p.username}** — ${cls?.name || '?'} — ${hp}${statuses}`;
  }).join('\n') || '*no party*';

  const enemiesField = run.currentRoom?.enemies?.length
    ? run.currentRoom.enemies.filter(e => e.hp > 0).map(e => {
        const statuses = e.statuses && e.statuses.length ? ` [${e.statuses.map(s => s.key).join(', ')}]` : '';
        return `${e.emoji} **${e.name}** — ${e.hp}/${e.maxHp} HP${statuses}`;
      }).join('\n') || '*none standing*'
    : '*exploring...*';

  const relicsField = run.relics && run.relics.length
    ? run.relics.map(k => {
        const r = getRelic(k);
        return r ? `${r.emoji} ${r.name}` : `❔ ${k}`;
      }).join('\n')
    : '*none*';

  const embed = new EmbedBuilder()
    .setColor(COLOR_COMBAT)
    .setTitle(`🏰 The Spoiled Vault — Floor ${run.floor}`)
    .addFields(
      { name: 'Party', value: partyField, inline: false },
      { name: 'Enemies', value: enemiesField, inline: false },
      { name: 'Relics', value: relicsField, inline: true },
      { name: 'Pot', value: `${run.pot.toLocaleString()} 🥛`, inline: true },
    );
  if (run.log && run.log.length) {
    embed.addFields({ name: 'Combat log', value: run.log.slice(-6).join('\n').slice(0, 1024) });
  }
  return { embeds: [embed] };
}

// === Turn buttons (ephemeral, shown to the active player) ===

function buildTurnActions(run, player) {
  const cls = getClass(player.classKey);
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dun_atk_${run.runId}`).setLabel('Attack').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dun_abi_${run.runId}_${cls.abilities[0].key}`)
      .setLabel(cls.abilities[0].name)
      .setEmoji(cls.emoji)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!!player.cooldowns[cls.abilities[0].key]),
    new ButtonBuilder()
      .setCustomId(`dun_abi_${run.runId}_${cls.abilities[1].key}`)
      .setLabel(cls.abilities[1].name)
      .setEmoji(cls.emoji)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!!player.cooldowns[cls.abilities[1].key]),
    new ButtonBuilder().setCustomId(`dun_def_${run.runId}`).setLabel('Defend').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dun_item_${run.runId}`)
      .setLabel('Use Item')
      .setEmoji('🎒')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!player.items || player.items.length === 0),
  );
  const embed = new EmbedBuilder()
    .setColor(COLOR_COMBAT)
    .setTitle(`Your turn, ${player.username}`)
    .setDescription(`**${cls.name}** — ${player.hp}/${player.maxHp} HP\nChoose an action. 90s timeout.`);
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
  const embed = new EmbedBuilder()
    .setColor(COLOR_VICTORY)
    .setTitle(`✅ Floor ${run.floor} cleared`)
    .setDescription('Moving to the next floor. The rot runs deeper.');
  return { embeds: [embed] };
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
};
