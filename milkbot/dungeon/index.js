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
  state.restoreActiveRuns();

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
  await require('../commands/dungeon').refreshChannelPanels(client, channel).catch(e => console.error('[dungeon] panel refresh failed:', e.message));
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
