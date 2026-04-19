const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ── Button helper ──────────────────────────────────────────────────────────────
function btn(customId, label, style) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

// ── Menu builders ──────────────────────────────────────────────────────────────
function buildMain(userId) {
  return {
    content: '🥛 **MILKBOT GAMES** — pick your poison',
    components: [
      new ActionRowBuilder().addComponents(
        btn(`g_cat_casino_${userId}`,  '🎰 Casino',  ButtonStyle.Primary),
        btn(`g_cat_social_${userId}`,  '⚔️ Social',  ButtonStyle.Primary),
        btn(`g_cat_wallet_${userId}`,  '💰 Wallet',  ButtonStyle.Secondary),
      ),
    ],
  };
}

function buildCasino(userId) {
  return {
    content: '🎰 **CASINO** — bet it all, lose it all, cry about it 🥛',
    components: [
      new ActionRowBuilder().addComponents(
        btn(`g_play_slots_${userId}`,     '🎲 Slots — 10🥛', ButtonStyle.Success),
        btn(`g_play_roulette_${userId}`,  '🎡 Roulette',     ButtonStyle.Primary),
        btn(`g_play_plinko_${userId}`,    '🪣 Plinko',       ButtonStyle.Primary),
        btn(`g_play_fliphouse_${userId}`, '🏠 Flip House',   ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        btn(`g_play_blackjack_${userId}`, '🃏 Blackjack',    ButtonStyle.Primary),
        btn(`g_play_bjt_${userId}`,       '🏆 Tournament',  ButtonStyle.Primary),
        btn(`g_play_coinflip_${userId}`,  '🤝 Coinflip',    ButtonStyle.Primary),
        btn(`g_play_lottery_${userId}`,   '🎟️ Lottery',     ButtonStyle.Primary),
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
    content: '⚔️ **SOCIAL** — raid · rob · scramble · milk trivia · geo · trivia crack · boss',
    components: [
      new ActionRowBuilder().addComponents(
        btn(`g_play_raid_${userId}`,        '⚔️ Raid',         ButtonStyle.Danger),
        btn(`g_play_rob_${userId}`,         '🔫 Rob',          ButtonStyle.Danger),
        btn(`g_play_scramble_${userId}`,    '🔤 Scramble',     ButtonStyle.Primary),
        btn(`g_play_trivia_${userId}`,      '🥛 Milk Trivia',  ButtonStyle.Primary),
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
    content: '💰 **WALLET** — your sad little milk bucks',
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

const CAT_BUILDERS = { casino: buildCasino, social: buildSocial, wallet: buildWallet };

// ── Fake message for games that don't need real mentions ───────────────────────
function autoDelete(promise) {
  return promise.then(m => { setTimeout(() => m?.delete().catch(() => {}), 15000); return m; });
}

// mode: 'channel' | 'autodelete'
function makeFakeMessage(interaction, mode = 'autodelete') {
  const sendFn =
    mode === 'channel'
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
  const promptMsg = await interaction.channel.send(prompt).catch(() => null);
  setTimeout(() => promptMsg?.delete().catch(() => {}), 20000);
  const result = await interaction.channel.awaitMessages({
    filter: m => m.author.id === userId,
    max: 1,
    time: 30000,
  }).catch(() => null);
  promptMsg?.delete().catch(() => {});
  if (!result || result.size === 0) {
    const tm = await interaction.channel.send(`timed out. no action taken. 🥛`).catch(() => null);
    setTimeout(() => tm?.delete().catch(() => {}), 5000);
    return null;
  }
  const msg = result.first();
  msg.delete().catch(() => {});
  return msg;
}

// Co-op games post publicly and manage their own lifecycle
const COOP_GAMES = new Set(['scramble', 'trivia', 'triviacrack', 'geo']);
// Interactive games need a persistent public message for button interactions
const INTERACTIVE_GAMES = new Set(['blackjack', 'bjt', 'coinflip', 'raid']);
// Passive lookups — don't count as an active game
const PASSIVE_GAMES = new Set(['balance', 'xp', 'ach', 'prestige', 'jackpot', 'bossstatus', 'crate', 'daily']);

const activeGameUsers = new Set();
const lastGameTime = new Map();

// ── Game dispatcher ────────────────────────────────────────────────────────────
async function handleGame(interaction, game, userId) {
  if (!PASSIVE_GAMES.has(game)) {
    if (activeGameUsers.has(userId)) {
      await interaction.deferUpdate();
      const msg = await interaction.channel.send(`you're already in a game. finish it first 🥛`).catch(() => null);
      setTimeout(() => msg?.delete().catch(() => {}), 5000);
      return;
    }
    const last = lastGameTime.get(userId) || 0;
    if (Date.now() - last < 8000) {
      await interaction.deferUpdate();
      const msg = await interaction.channel.send(`slow down 🥛`).catch(() => null);
      setTimeout(() => msg?.delete().catch(() => {}), 4000);
      return;
    }
    lastGameTime.set(userId, Date.now());
    activeGameUsers.add(userId);
    setTimeout(() => activeGameUsers.delete(userId), 60000); // safety release after 60s
  }
  const release = () => activeGameUsers.delete(userId);

  const mode = COOP_GAMES.has(game) || INTERACTIVE_GAMES.has(game) ? 'channel' : 'autodelete';
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
        interaction.followUp({ content, flags: 64 }).catch(() => {});
      } else {
        autoDelete(interaction.channel.send(content));
      }
    },
    bossstatus: async () => {
      const s = require('../state');
      if (!s.activeRaidBoss) {
        interaction.followUp({ content: `🐄 No raid boss tonight. Check back at midnight EST. 🥛`, flags: 64 }).catch(() => {});
      } else {
        // Bump the full boss embed (with attack button) to the bottom of this channel
        await require('./raidboss').bumpBoss(interaction.client, interaction.channel).catch(console.error);
      }
    },
  };

  if (oneClick[game]) {
    await interaction.deferUpdate();
    oneClick[game]();
    release();
    return;
  }

  // Amount-only games
  const amountGames = {
    blackjack: '🃏 How much do you want to bet? *(min 25 🥛)*',
    plinko:    '🪣 How much do you want to bet? *(min 10 🥛)*',
    fliphouse: '🏠 How much do you want to flip for?',
    bjt:       '🏆 Enter your tournament buy-in *(min 50 🥛)*',
    raid:      '⚔️ How much are you putting into the raid?',
  };

  if (game === 'lottery') {
    await interaction.deferUpdate();
    const lt = require('./lottery');
    const lotteryData = lt.getLotteryState();
    const totalTickets = lotteryData.entries.length;
    const uniqueUsers  = new Set(lotteryData.entries).size;
    const pot          = lotteryData.pot.toLocaleString();
    const lotteryPrompt =
      `🎟️ **LOTTERY**\n` +
      `🥛 **Pot:** ${pot} milk bucks\n` +
      `🎫 **Tickets sold:** ${totalTickets} (${uniqueUsers} player${uniqueUsers !== 1 ? 's' : ''} in)\n\n` +
      `How many tickets do you want? *(10 🥛 each)*`;
    const msg = await collect(interaction, lotteryPrompt, userId);
    release();
    if (!msg) return;
    lt.execute(fakeMsg, [msg.content.trim()]);
    return;
  }

  if (amountGames[game]) {
    await interaction.deferUpdate();
    const msg = await collect(interaction, amountGames[game], userId);
    release();
    if (!msg) return;
    require(`./${game}`).execute(fakeMsg, [msg.content.trim()]);
    return;
  }

  // Roulette: amount + bet type on one line
  if (game === 'roulette') {
    await interaction.deferUpdate();
    const msg = await collect(interaction, '🎡 Type your bet: `amount red`, `amount black`, or `amount 0–36` *(min 10 🥛)*', userId);
    release();
    if (!msg) return;
    require('./roulette').execute(fakeMsg, msg.content.trim().split(/\s+/));
    return;
  }

  // @user games — collect a real message so Discord populates mentions.users properly
  if (game === 'rob') {
    await interaction.deferUpdate();
    const msg = await collect(interaction, '🔫 Who do you want to rob? Reply with **@user**', userId);
    release();
    if (!msg) return;
    require('./rob').execute(msg, msg.content.trim().split(/\s+/));
    return;
  }

  if (game === 'give') {
    await interaction.deferUpdate();
    const msg = await collect(interaction, '💸 Reply with **@user amount**', userId);
    release();
    if (!msg) return;
    require('./give').execute(msg, msg.content.trim().split(/\s+/));
    return;
  }

  if (game === 'coinflip') {
    await interaction.deferUpdate();
    const msg = await collect(interaction, '🤝 Challenge someone: Reply with **@user amount**', userId);
    release();
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
    await interaction.reply({ ...buildMain(userId), flags: 64 });
  },

  async execute(message) {
    message.delete().catch(() => {});
    const reply = await message.channel.send('use `/g` to open the menu 🥛');
    setTimeout(() => reply.delete().catch(() => {}), 5000);
  },

  async handleButtonInteraction(interaction) {
    const parts = interaction.customId.split('_');
    // formats: g_back_{userId} | g_cat_{cat}_{userId} | g_play_{game}_{userId}
    const action = parts[1];
    const userId = parts[parts.length - 1];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: `that's not your menu 🥛`, flags: 64 });
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
      const VALID_GAMES = new Set([
        'slots','scramble','trivia','triviacrack','geo','daily','balance','xp',
        'ach','prestige','crate','jackpot','bossstatus',
        'blackjack','plinko','fliphouse','bjt','raid','lottery',
        'roulette','rob','give','coinflip',
      ]);
      if (!VALID_GAMES.has(game)) return interaction.deferUpdate();
      await handleGame(interaction, game, userId).catch(err => {
        console.error(`[g] game error (${game}):`, err);
        interaction.followUp({ content: `something went wrong. try again. 🥛`, flags: 64 }).catch(() => {});
      });
    }
  },
};
