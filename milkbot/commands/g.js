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
  return {
    content: '⚔️ **SOCIAL** — raid · rob · scramble · trivia · geo · trivia crack',
    components: [
      new ActionRowBuilder().addComponents(
        btn(`g_play_raid_${userId}`,        '⚔️ Raid',         ButtonStyle.Danger),
        btn(`g_play_rob_${userId}`,         '🔫 Rob',          ButtonStyle.Danger),
        btn(`g_play_scramble_${userId}`,    '🔤 Scramble',     ButtonStyle.Primary),
        btn(`g_play_trivia_${userId}`,      '🧠 Trivia',       ButtonStyle.Primary),
        btn(`g_play_geo_${userId}`,         '🌍 Geo',          ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        btn(`g_play_triviacrack_${userId}`, '📚 Trivia Crack', ButtonStyle.Primary),
        btn(`g_play_coinflip_${userId}`,    '🤝 Coinflip',     ButtonStyle.Primary),
        btn(`g_back_${userId}`,             '⬅️ Back',         ButtonStyle.Secondary),
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
        btn(`g_play_give_${userId}`,     '💸 Give',         ButtonStyle.Primary),
        btn(`g_play_crate_${userId}`,    '📦 Claim Crate',  ButtonStyle.Success),
        btn(`g_back_${userId}`,          '⬅️ Back',         ButtonStyle.Secondary),
      ),
    ],
  };
}

const CAT_BUILDERS = { casino: buildCasino, cards: buildCards, social: buildSocial, wallet: buildWallet };

// ── Fake message for games that don't need real mentions ───────────────────────
function makeFakeMessage(interaction) {
  return {
    author: { id: interaction.user.id, username: interaction.user.username },
    channel: interaction.channel,
    guild: interaction.guild,
    content: '',
    reply: (content) => interaction.channel.send(content),
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

// ── Game dispatcher ────────────────────────────────────────────────────────────
async function handleGame(interaction, game, userId) {
  const fakeMsg = makeFakeMessage(interaction);

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
