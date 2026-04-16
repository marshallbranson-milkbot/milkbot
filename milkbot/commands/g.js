const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ── Button helper ──────────────────────────────────────────────────────────────
function btn(customId, label, style) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

// ── Menu builders ──────────────────────────────────────────────────────────────
function buildMain(userId) {
  return {
    content: '🥛 **MILKBOT** — what are we doing',
    components: [
      new ActionRowBuilder().addComponents(
        btn(`g_cat_casino_${userId}`,  '🎰 Casino',  ButtonStyle.Primary),
        btn(`g_cat_cards_${userId}`,   '🃏 Cards',   ButtonStyle.Primary),
        btn(`g_cat_social_${userId}`,  '⚔️ Social',  ButtonStyle.Primary),
        btn(`g_cat_wallet_${userId}`,  '💰 Wallet',  ButtonStyle.Secondary),
      ),
    ],
  };
}

function buildCasino(userId) {
  return {
    content: '🎰 **CASINO** — slots · roulette · plinko · flip house · coinflip · lottery',
    components: [
      new ActionRowBuilder().addComponents(
        btn(`g_play_slots_${userId}`,     '🎲 Slots — 10🥛',  ButtonStyle.Success),
        btn(`g_play_roulette_${userId}`,  '🎡 Roulette',      ButtonStyle.Primary),
        btn(`g_play_plinko_${userId}`,    '🪣 Plinko',        ButtonStyle.Primary),
        btn(`g_play_fliphouse_${userId}`, '🏠 Flip House',    ButtonStyle.Primary),
        btn(`g_play_coinflip_${userId}`,  '🤝 Coinflip',      ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        btn(`g_play_lottery_${userId}`,   '🎟️ Lottery',       ButtonStyle.Primary),
        btn(`g_back_${userId}`,           '⬅️ Back',          ButtonStyle.Secondary),
      ),
    ],
  };
}

function buildCards(userId) {
  return {
    content: '🃏 **CARDS** — blackjack · tournament',
    components: [
      new ActionRowBuilder().addComponents(
        btn(`g_play_blackjack_${userId}`, '🃏 Blackjack',    ButtonStyle.Success),
        btn(`g_play_bjt_${userId}`,       '🏆 Tournament',  ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        btn(`g_back_${userId}`,           '⬅️ Back',        ButtonStyle.Secondary),
      ),
    ],
  };
}

function buildSocial(userId) {
  const state = require('../state');
  const bossActive = !!state.activeRaidBoss;
  return {
    content: '⚔️ **SOCIAL** — raid · rob · scramble · trivia · geo · trivia crack · boss',
    components: [
      new ActionRowBuilder().addComponents(
        btn(`g_play_raid_${userId}`,        '⚔️ Raid',         ButtonStyle.Danger),
        btn(`g_play_rob_${userId}`,         '🔫 Rob',          ButtonStyle.Danger),
        btn(`g_play_scramble_${userId}`,    '🔤 Scramble',     ButtonStyle.Primary),
        btn(`g_play_trivia_${userId}`,      '🧠 Trivia',       ButtonStyle.Primary),
        btn(`g_play_geo_${userId}`,         '🌍 Geo',          ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        btn(`g_play_triviacrack_${userId}`, '📚 Trivia Crack',                                   ButtonStyle.Primary),
        btn(`g_play_coinflip_${userId}`,    '🤝 Coinflip',                                       ButtonStyle.Primary),
        btn(`g_play_bossstatus_${userId}`,  bossActive ? '🐄 Boss [ACTIVE]' : '🐄 Boss',         bossActive ? ButtonStyle.Danger : ButtonStyle.Secondary),
        btn(`g_back_${userId}`,             '⬅️ Back',                                           ButtonStyle.Secondary),
      ),
    ],
  };
}

function buildWallet(userId) {
  return {
    content: '💰 **WALLET** — balance · xp · daily · achievements · prestige · give · crate',
    components: [
      new ActionRowBuilder().addComponents(
        btn(`g_play_balance_${userId}`,  '💰 Balance',      ButtonStyle.Secondary),
        btn(`g_play_xp_${userId}`,       '⭐ XP',           ButtonStyle.Secondary),
        btn(`g_play_daily_${userId}`,    '📅 Daily',        ButtonStyle.Success),
        btn(`g_play_ach_${userId}`,      '🏆 Achievements', ButtonStyle.Secondary),
        btn(`g_play_prestige_${userId}`, '🌟 Prestige',     ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        btn(`g_play_give_${userId}`,     '💸 Give',          ButtonStyle.Primary),
        btn(`g_play_crate_${userId}`,    '📦 Claim Crate',   ButtonStyle.Success),
        btn(`g_play_jackpot_${userId}`,  '🎰 Jackpot',       ButtonStyle.Secondary),
        btn(`g_back_${userId}`,          '⬅️ Back',          ButtonStyle.Secondary),
      ),
    ],
  };
}

const CAT_BUILDERS = { casino: buildCasino, cards: buildCards, social: buildSocial, wallet: buildWallet };

// ── Fake message for games that don't need real mentions ───────────────────────
function autoDelete(promise) {
  return promise.then(m => { setTimeout(() => m?.delete().catch(() => {}), 10000); return m; });
}

// Returns true if the button was clicked on an ephemeral message (i.e. /g slash)
function isEphemeralContext(interaction) {
  return !!(interaction.message?.flags?.bitfield & 64);
}

// mode: 'ephemeral' | 'channel' | 'autodelete'
function makeFakeMessage(interaction, mode = 'autodelete') {
  const sendFn =
    mode === 'ephemeral'
      ? async (content) => {
          const payload = typeof content === 'string' ? { content } : content;
          return interaction.followUp({ ...payload, ephemeral: true }).catch(() => null);
        }
      : mode === 'channel'
        ? (content) => interaction.channel.send(content)
        : (content) => autoDelete(interaction.channel.send(content));

  const channelProxy = new Proxy(interaction.channel, {
    get(target, prop) {
      if (prop === 'send') return sendFn;
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  return {
    author: { id: interaction.user.id, username: interaction.user.username },
    channel: channelProxy,
    guild: interaction.guild,
    content: '',
    reply: sendFn,
    delete: () => Promise.resolve(),
    mentions: { users: { first: () => null, size: 0 } },
  };
}

// ── Collect one message from the user in the channel ──────────────────────────
async function collect(interaction, prompt, userId) {
  await interaction.followUp({ content: prompt, ephemeral: true });
  const result = await interaction.channel.awaitMessages({
    filter: m => m.author.id === userId,
    max: 1,
    time: 30000,
  }).catch(() => null);
  if (!result || result.size === 0) {
    interaction.followUp({ content: `timed out. no action taken. 🥛`, ephemeral: true }).catch(() => {});
    return null;
  }
  const msg = result.first();
  msg.delete().catch(() => {});
  return msg;
}

// Co-op games always post publicly; solo games go ephemeral when triggered from /g
const COOP_GAMES = new Set(['scramble', 'trivia', 'triviacrack', 'geo']);

// ── Game dispatcher ────────────────────────────────────────────────────────────
async function handleGame(interaction, game, userId) {
  const isSlash = isEphemeralContext(interaction);
  const mode = COOP_GAMES.has(game) ? 'channel' : (isSlash ? 'ephemeral' : 'autodelete');
  const fakeMsg = makeFakeMessage(interaction, mode);

  // One-click games (no input needed)
  const oneClick = {
    slots:      () => require('./slots').execute(fakeMsg),
    scramble:   () => require('./scramble').execute(fakeMsg),
    trivia:     () => require('./milktrivia').execute(fakeMsg),
    triviacrack:() => require('./trivia').execute(fakeMsg),
    geo:        () => require('./geo').execute(fakeMsg),
    daily:      () => require('./daily').execute(fakeMsg),
    balance:    () => require('./balance').execute(fakeMsg),
    xp:         () => require('./xp').execute(fakeMsg),
    ach:        () => require('./ach').execute(fakeMsg),
    prestige:   () => require('./prestige').execute(fakeMsg),
    crate:      () => require('./crate').execute(fakeMsg),
    jackpot:    () => {
      const amt = require('../jackpot').getJackpot();
      const content = `🎰 **SERVER JACKPOT: ${amt.toLocaleString()} milk bucks** — win any game for a 0.1% chance to claim it all. 🥛`;
      if (mode === 'ephemeral') {
        interaction.followUp({ content, ephemeral: true }).catch(() => {});
      } else {
        autoDelete(interaction.channel.send(content));
      }
    },
    bossstatus: async () => {
      const s = require('../state');
      if (!s.activeRaidBoss) {
        interaction.followUp({ content: `🐄 No raid boss tonight. Check back at midnight EST. 🥛`, ephemeral: true }).catch(() => {});
      } else {
        // Bump the full boss embed (with attack button) to the bottom of this channel
        await require('./raidboss').bumpBoss(interaction.client, interaction.channel).catch(console.error);
      }
    },
  };

  if (oneClick[game]) {
    await interaction.deferUpdate();
    oneClick[game]();
    return;
  }

  // Amount-only games
  const amountGames = {
    blackjack: '🃏 How much do you want to bet? *(min 25 🥛)*',
    plinko:    '🪣 How much do you want to bet? *(min 10 🥛)*',
    fliphouse: '🏠 How much do you want to flip for?',
    bjt:       '🏆 Enter your tournament buy-in *(min 50 🥛)*',
    raid:      '⚔️ How much are you putting into the raid?',
    lottery:   '🎟️ How many lottery tickets? *(10 🥛 each)*',
  };

  if (amountGames[game]) {
    await interaction.deferUpdate();
    const msg = await collect(interaction, amountGames[game], userId);
    if (!msg) return;
    require(`./${game}`).execute(fakeMsg, [msg.content.trim()]);
    return;
  }

  // Roulette: amount + bet type on one line
  if (game === 'roulette') {
    await interaction.deferUpdate();
    const msg = await collect(interaction, '🎡 Type your bet: `amount red`, `amount black`, or `amount 0–36` *(min 10 🥛)*', userId);
    if (!msg) return;
    require('./roulette').execute(fakeMsg, msg.content.trim().split(/\s+/));
    return;
  }

  // @user games — collect a real message so Discord populates mentions.users properly
  if (game === 'rob') {
    await interaction.deferUpdate();
    const msg = await collect(interaction, '🔫 Who do you want to rob? Reply with **@user**', userId);
    if (!msg) return;
    require('./rob').execute(msg, msg.content.trim().split(/\s+/));
    return;
  }

  if (game === 'give') {
    await interaction.deferUpdate();
    const msg = await collect(interaction, '💸 Reply with **@user amount**', userId);
    if (!msg) return;
    require('./give').execute(msg, msg.content.trim().split(/\s+/));
    return;
  }

  if (game === 'coinflip') {
    await interaction.deferUpdate();
    const msg = await collect(interaction, '🤝 Challenge someone: Reply with **@user amount**', userId);
    if (!msg) return;
    require('./coinflip').execute(msg, msg.content.trim().split(/\s+/));
    return;
  }
}

// ── Module exports ─────────────────────────────────────────────────────────────
module.exports = {
  name: 'g',
  description: 'Open the MilkBot game menu.',
  slashOptions: [], // no options — registered as slash command for ephemeral support

  // Slash command handler — replies ephemerally so only the requester sees the menu
  async executeSlash(interaction) {
    const userId = interaction.user.id;
    await interaction.reply({ ...buildMain(userId), ephemeral: true });
  },

  async execute(message) {
    const userId = message.author.id;
    const menuMsg = await message.channel.send(buildMain(userId));
    message.delete().catch(() => {});
    setTimeout(() => menuMsg.delete().catch(() => {}), 5 * 60 * 1000);
  },

  async handleButtonInteraction(interaction) {
    const parts = interaction.customId.split('_');
    // formats: g_back_{userId} | g_cat_{cat}_{userId} | g_play_{game}_{userId}
    const action = parts[1];
    const userId = parts[parts.length - 1];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: `that's not your menu 🥛`, ephemeral: true });
    }

    if (action === 'back') {
      return interaction.update(buildMain(userId));
    }

    if (action === 'cat') {
      const cat = parts[2];
      const builder = CAT_BUILDERS[cat];
      return builder ? interaction.update(builder(userId)) : interaction.deferUpdate();
    }

    if (action === 'play') {
      const game = parts[2];
      await handleGame(interaction, game, userId).catch(err => {
        console.error(`[g] game error (${game}):`, err);
        interaction.followUp({ content: `something went wrong. try again. 🥛`, ephemeral: true }).catch(() => {});
      });
    }
  },
};
