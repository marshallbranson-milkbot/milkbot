// Public surface for the dungeon module.
// Re-exports state + lifecycle helpers used by commands/dungeon.js and milkbot/index.js.

const state = require('./state');
const classes = require('./classes');
const enemies = require('./enemies');
const combat = require('./combat');
const rooms = require('./rooms');
const loot = require('./loot');
const display = require('./display');
const rng = require('./rng');

const DUNGEON_CHANNEL_NAME = 'milkbot-dungeon';

// Called from milkbot/index.js inside the ready handler.
// Restores active runs from disk, posts the lobby panel in #milkbot-dungeon (if gated on by DUNGEON_ENABLED=1).
async function init(client) {
  if (process.env.DUNGEON_ENABLED !== '1') {
    console.log('[dungeon] DUNGEON_ENABLED != 1 — skipping init');
    return;
  }
  state.installShutdownHooks();
  state.backfillClassUnlocks();
  const restored = state.restoreActiveRuns();

  const guildId = '562076997979865118';
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.warn('[dungeon] guild not found, skipping channel init');
    return;
  }
  const channel = guild.channels.cache.find(c => c.name === DUNGEON_CHANNEL_NAME);
  if (!channel) {
    console.warn(`[dungeon] #${DUNGEON_CHANNEL_NAME} not found — create it in Discord and restart`);
    return;
  }

  // Verify each restored run's thread still exists; prune stale runs.
  const cmd = require('../commands/dungeon');
  for (const run of restored) {
    if (!run.threadId) continue;
    const thread = await client.channels.fetch(run.threadId).catch(() => null);
    if (!thread || thread.archived) {
      console.log(`[dungeon] pruning stale run ${run.runId} (thread gone/archived)`);
      state.deleteRun(run.runId);
      continue;
    }
    if (run.state === 'PLAYING') {
      await thread.send({ content: `🔄 **Run recovered after bot restart.** Re-posting the current turn now.` }).catch(() => {});
      // Actively re-prompt the current player — the pre-shutdown turn message
      // was deleted and _activeTurnMessageId isn't persisted.
      await cmd.resumePlayingRun(run, thread).catch(e => console.warn('[dungeon] resume failed:', e.message));
    }
  }
  state.flushActiveRunsNow();

  await cmd.refreshChannelPanels(client, channel).catch(e => console.error('[dungeon] panel refresh failed:', e.message));
  console.log('[dungeon] ready');
}

module.exports = {
  state,
  classes,
  enemies,
  combat,
  rooms,
  loot,
  display,
  rng,
  init,
  DUNGEON_CHANNEL_NAME,
};
