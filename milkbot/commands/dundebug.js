// Dungeon debug command — gated to the bot owner for live testing.
// Usage: /dundebug action:"heal" | "floor 8" | "grant cheese_crown" | "loot"
// Must be invoked inside an active dungeon thread.

const dungeon = require('../dungeon');
const { state, loot, combat } = dungeon;

const OWNER_ID = process.env.DUNGEON_ADMIN_ID || '879171470700445747';

async function executeSlash(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: 'Not for you.', flags: 64 });
  }
  if (process.env.DUNGEON_ENABLED !== '1') {
    return interaction.reply({ content: 'Dungeon is not enabled.', flags: 64 });
  }

  // Find active run that the invoker is in (or a specific threadId match)
  const threadId = interaction.channelId;
  const run = state.allRuns().find(r => r.threadId === threadId);
  if (!run) {
    return interaction.reply({ content: "Run this in an active dungeon thread.", flags: 64 });
  }

  const action = (interaction.options.getString('action') || '').trim();
  const [cmd, ...rest] = action.split(/\s+/);
  const arg = rest.join(' ');

  let reply = '';
  if (cmd === 'heal') {
    for (const p of run.party) {
      p.hp = p.maxHp;
      p.downed = false;
      p.statuses = [];
    }
    reply = '🩹 Party fully healed.';
  } else if (cmd === 'floor') {
    const n = Number(arg);
    if (!Number.isFinite(n) || n < 1 || n > 10) {
      reply = 'Invalid floor (1-10).';
    } else {
      run.floor = n;
      reply = `📍 Floor set to ${n}.`;
    }
  } else if (cmd === 'grant') {
    const relic = loot.getRelic(arg);
    const consumable = loot.getConsumable(arg);
    if (relic) {
      if (!run.relics.includes(arg)) run.relics.push(arg);
      reply = `🏺 Granted relic ${arg}.`;
    } else if (consumable) {
      run.party[0].items.push(arg);
      reply = `🎒 Granted ${arg} to ${run.party[0].username}.`;
    } else {
      reply = `Unknown: ${arg}`;
    }
  } else if (cmd === 'loot') {
    for (let i = 0; i < 5; i++) {
      const c = loot.rollConsumableDrop(run.rng);
      run.party[0].items.push(c.key);
    }
    reply = `🎒 Granted 5 consumables to ${run.party[0].username}.`;
  } else if (cmd === 'relic') {
    const r = loot.rollRelicDrop(run.rng);
    if (!run.relics.includes(r.key)) run.relics.push(r.key);
    reply = `🏺 Granted relic ${r.name}.`;
  } else if (cmd === 'end') {
    reply = '🏁 Ending run...';
    await interaction.reply({ content: reply, flags: 64 });
    const thread = await interaction.client.channels.fetch(run.threadId).catch(() => null);
    if (thread) await require('./dungeon').handleButtonInteraction({ ...interaction, customId: `dun_abandon_${run.runId}` });
    return;
  } else {
    reply = 'actions: heal | floor N | grant KEY | loot | relic | end';
  }
  state.markDirty(run);
  await interaction.reply({ content: reply, flags: 64 });
}

module.exports = {
  name: 'dundebug',
  description: 'Dungeon debug (owner only)',
  slashOptions: [
    { name: 'action', description: 'Action: heal | floor N | grant KEY | loot | relic | end', type: 'STRING', required: true },
  ],
  executeSlash,
  // execute unused but required by slashbridge
  execute: () => {},
};
