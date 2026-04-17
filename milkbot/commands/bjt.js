const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const balancesPath = path.join(__dirname, '../data/balances.json');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const MIN_BUYIN      = 50;
const JOIN_WINDOW    = 30000;
const ACTION_TIMEOUT = 20000;

function getData(p) {
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function saveData(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function cardStr(c)  { return `\`${c.rank}${c.suit}\``; }
function handStr(h)  { return h.map(cardStr).join(' '); }
function cardValue(r) {
  if (['J', 'Q', 'K'].includes(r)) return 10;
  if (r === 'A') return 11;
  return parseInt(r);
}
function handTotal(h) {
  let t = 0, aces = 0;
  for (const c of h) { t += cardValue(c.rank); if (c.rank === 'A') aces++; }
  while (t > 21 && aces > 0) { t -= 10; aces--; }
  return t;
}
function isBlackjack(h) { return h.length === 2 && handTotal(h) === 21; }

// ─── TOURNAMENT STATE ────────────────────────────────────────────────────────

let activeTournament = null;

// Called from raid.js when someone types !j
function tryJoin(message) {
  if (!activeTournament || activeTournament.state !== 'WAITING') return false;

  const userId   = message.author.id;
  const username = message.member?.displayName ?? message.author.username;

  if (activeTournament.players.some(p => p.userId === userId)) {
    message.reply(`you're already in the tournament. 🃏`).catch(() => {});
    return true;
  }

  const balances = getData(balancesPath);
  const bal = balances[userId] || 0;
  if (bal < activeTournament.buyIn) {
    message.reply(`you need **${activeTournament.buyIn} milk bucks** to join. you've got **${bal}**. 🥛`).catch(() => {});
    return true;
  }

  balances[userId] = bal - activeTournament.buyIn;
  saveData(balancesPath, balances);

  activeTournament.players.push({ userId, username, hand: [], stood: false, busted: false, result: null });

  const count = activeTournament.players.length;
  activeTournament.channel.send(
    `🃏 **${username}** joined the tournament! **${count} player${count !== 1 ? 's' : ''}** in so far. 🥛`
  ).catch(() => {});

  return true;
}

// ─── TURN MANAGEMENT ─────────────────────────────────────────────────────────

function promptCurrentPlayer() {
  if (!activeTournament) return;
  if (activeTournament.actionTimer) clearTimeout(activeTournament.actionTimer);

  const player = activeTournament.players[activeTournament.currentPlayerIndex];
  const total  = handTotal(player.hand);

  activeTournament.actionTimer = setTimeout(() => {
    if (!activeTournament) return;
    player.stood = true;
    activeTournament.channel.send(
      `⏰ **${player.username}** timed out — auto-stand at **${total}**. 🥛`
    ).catch(() => {});
    activeTournament.currentPlayerIndex++;
    promptNextPlayer();
  }, ACTION_TIMEOUT);
}

function promptNextPlayer() {
  if (!activeTournament) return;

  // Skip players who have already acted
  while (
    activeTournament.currentPlayerIndex < activeTournament.players.length &&
    (activeTournament.players[activeTournament.currentPlayerIndex].stood ||
     activeTournament.players[activeTournament.currentPlayerIndex].busted)
  ) {
    activeTournament.currentPlayerIndex++;
  }

  if (activeTournament.currentPlayerIndex >= activeTournament.players.length) {
    return resolveTournament();
  }

  const player = activeTournament.players[activeTournament.currentPlayerIndex];
  activeTournament.channel.send(
    `🃏 **${player.username}** — ${handStr(player.hand)} *(${handTotal(player.hand)})* — \`hit\` or \`stand\` *(20s)*`
  ).catch(() => {});

  promptCurrentPlayer();
}

// ─── RESOLVE ─────────────────────────────────────────────────────────────────

function resolveTournament() {
  if (!activeTournament) return;
  if (activeTournament.actionTimer) clearTimeout(activeTournament.actionTimer);

  activeTournament.state = 'RESOLVING';
  const { players, deck, dealerHand, buyIn, channel } = activeTournament;
  activeTournament = null;

  // Dealer plays until >= 17
  while (handTotal(dealerHand) < 17) dealerHand.push(deck.pop());

  const dealerTotal = handTotal(dealerHand);
  const dealerBJ    = isBlackjack(dealerHand);

  const balances = getData(balancesPath);
  const winners  = [];
  const pushers  = [];
  const losers   = [];

  for (const p of players) {
    const pt = handTotal(p.hand);
    const playerBJ = isBlackjack(p.hand);

    if (p.busted || (pt > 21 && !playerBJ)) {
      p.result = `bust (${pt})`;
      losers.push(p);
    } else if (dealerBJ && !playerBJ) {
      p.result = `dealer blackjack`;
      losers.push(p);
    } else if (playerBJ && dealerBJ) {
      p.result = `push — both blackjack`;
      balances[p.userId] = Math.min(10_000_000, (balances[p.userId] || 0) + buyIn);
      pushers.push(p);
    } else if (playerBJ) {
      // Natural blackjack beats dealer — 3:2 payout
      const bjPayout = buyIn + Math.floor(buyIn * 1.5);
      p.result = `blackjack! (+${Math.floor(buyIn * 1.5)} mb)`;
      balances[p.userId] = Math.min(10_000_000, (balances[p.userId] || 0) + bjPayout);
      winners.push(p);
    } else if (dealerTotal > 21) {
      p.result = `dealer bust — win (${pt})`;
      balances[p.userId] = Math.min(10_000_000, (balances[p.userId] || 0) + buyIn * 2);
      winners.push(p);
    } else if (pt > dealerTotal) {
      p.result = `win (${pt} vs ${dealerTotal})`;
      balances[p.userId] = Math.min(10_000_000, (balances[p.userId] || 0) + buyIn * 2);
      winners.push(p);
    } else if (pt === dealerTotal) {
      p.result = `push (${pt})`;
      balances[p.userId] = Math.min(10_000_000, (balances[p.userId] || 0) + buyIn);
      pushers.push(p);
    } else {
      p.result = `loss (${pt} vs ${dealerTotal})`;
      losers.push(p);
    }
  }
  saveData(balancesPath, balances);

  // Build results embed
  const lines = [
    `🤖 **Dealer:** ${handStr(dealerHand)} *(${dealerTotal})*${dealerBJ ? ' — **BLACKJACK!**' : ''}`,
    '',
  ];
  for (const p of players) {
    const icon = winners.includes(p) ? '✅' : pushers.includes(p) ? '🔄' : '❌';
    lines.push(`${icon} **${p.username}:** ${handStr(p.hand)} *(${handTotal(p.hand)})* — ${p.result}`);
  }
  lines.push('');
  if (winners.length > 0) {
    const winStr = winners.map(w => `**${w.username}**`).join(', ');
    lines.push(`🏆 ${winStr} walk${winners.length === 1 ? 's' : ''} away richer. 🥛`);
  } else if (pushers.length === players.length) {
    lines.push(`🔄 everyone pushes. the universe is balanced. 🥛`);
  } else {
    lines.push(`🤖 dealer wins. the house drinks. 🥛`);
  }

  const embed = new EmbedBuilder()
    .setTitle('🃏  BLACKJACK TOURNAMENT — RESULTS  🃏')
    .setDescription(lines.join('\n'))
    .setColor(winners.length > 0 ? 0x44ff88 : 0xff4444);

  channel.send({ embeds: [embed] }).catch(console.error);
}

// ─── DEAL / START ─────────────────────────────────────────────────────────────

async function startTournament() {
  if (!activeTournament) return;
  activeTournament.state = 'PLAYING';

  const deck = buildDeck();
  activeTournament.deck = deck;

  // Deal 2 cards to each player, then 2 to dealer
  for (const p of activeTournament.players) p.hand = [deck.pop(), deck.pop()];
  activeTournament.dealerHand = [deck.pop(), deck.pop()];

  // Build deal embed
  const lines = [
    `🤖 **Dealer:** ${cardStr(activeTournament.dealerHand[0])} \`[?]\``,
    '',
  ];
  for (const p of activeTournament.players) {
    const bj = isBlackjack(p.hand);
    lines.push(
      `👤 **${p.username}:** ${handStr(p.hand)} *(${handTotal(p.hand)})*${bj ? ' — **BLACKJACK!** 🃏' : ''}`
    );
  }

  const dealEmbed = new EmbedBuilder()
    .setTitle('🃏  BLACKJACK TOURNAMENT — CARDS DEALT  🃏')
    .setDescription(lines.join('\n'))
    .setColor(0xffcc00);

  await activeTournament.channel.send({ embeds: [dealEmbed] }).catch(() => {});

  // Auto-stand players with blackjack
  for (const p of activeTournament.players) {
    if (isBlackjack(p.hand)) p.stood = true;
  }

  // If dealer has blackjack, resolve immediately
  if (isBlackjack(activeTournament.dealerHand)) {
    return resolveTournament();
  }

  // Start sequential turns
  activeTournament.currentPlayerIndex = 0;
  promptNextPlayer();
}

// ─── CHECK (intercepts 'hit' / 'stand' for active tournament) ────────────────

function check(message) {
  if (message.author.bot) return false;
  if (!activeTournament || activeTournament.state !== 'PLAYING') return false;

  const content = message.content.trim().toLowerCase();
  if (!['hit', 'stand'].includes(content)) return false;

  const currentPlayer = activeTournament.players[activeTournament.currentPlayerIndex];
  if (!currentPlayer || message.author.id !== currentPlayer.userId) return false;

  clearTimeout(activeTournament.actionTimer);
  activeTournament.actionTimer = null;

  if (content === 'hit') {
    currentPlayer.hand.push(activeTournament.deck.pop());
    const total = handTotal(currentPlayer.hand);

    if (total > 21) {
      currentPlayer.busted = true;
      activeTournament.channel.send(`💥 **${currentPlayer.username}** busted at **${total}**! 🥛`).catch(() => {});
      activeTournament.currentPlayerIndex++;
      promptNextPlayer();
    } else if (total === 21) {
      currentPlayer.stood = true;
      activeTournament.channel.send(`🎯 **${currentPlayer.username}** hits **21** — auto-stand! 🥛`).catch(() => {});
      activeTournament.currentPlayerIndex++;
      promptNextPlayer();
    } else {
      activeTournament.channel.send(
        `🃏 **${currentPlayer.username}** hits — ${handStr(currentPlayer.hand)} *(${total})* — \`hit\` or \`stand\`?`
      ).catch(() => {});
      promptCurrentPlayer();
    }
  } else {
    const total = handTotal(currentPlayer.hand);
    currentPlayer.stood = true;
    activeTournament.channel.send(`🛑 **${currentPlayer.username}** stands at **${total}**. 🥛`).catch(() => {});
    activeTournament.currentPlayerIndex++;
    promptNextPlayer();
  }

  return true;
}

// ─── COMMAND EXPORT ──────────────────────────────────────────────────────────

module.exports = {
  name: 'bjt',
  description: 'Blackjack tournament. 30s join window, everyone vs dealer, winners take 2x buy-in.',
  check,
  tryJoin,
  async execute(message, args) {
    if (activeTournament) {
      return message.reply(`a tournament is already in progress. type \`!j\` to join if it's still open. 🃏`);
    }

    const buyIn = parseInt(args[0], 10);
    if (!buyIn || buyIn < MIN_BUYIN) {
      return message.reply(`minimum buy-in is **${MIN_BUYIN} milk bucks**. \`!bjt <buy-in>\` 🃏`);
    }

    const userId   = message.author.id;
    const username = message.member?.displayName ?? message.author.username;
    const balances = getData(balancesPath);
    const bal      = balances[userId] || 0;

    if (bal < buyIn) {
      return message.reply(`you need **${buyIn} milk bucks** to host this tournament. you've got **${bal}**. 🥛`);
    }

    balances[userId] = bal - buyIn;
    saveData(balancesPath, balances);

    activeTournament = {
      state: 'WAITING',
      buyIn,
      players: [{ userId, username, hand: [], stood: false, busted: false, result: null }],
      deck: [],
      dealerHand: [],
      currentPlayerIndex: 0,
      channel: message.channel,
      actionTimer: null,
    };

    message.channel.send(
      `🃏 **BLACKJACK TOURNAMENT** 🃏\n` +
      `**${username}** is hosting — **${buyIn} milk buck** buy-in, everyone vs the dealer.\n` +
      `Type \`!j\` to join. You have **30 seconds**. Winners take **2x their buy-in** back. 🥛`
    ).catch(console.error);

    setTimeout(() => {
      if (!activeTournament) return;

      if (activeTournament.players.length < 2) {
        const bals = getData(balancesPath);
        for (const p of activeTournament.players) {
          bals[p.userId] = (bals[p.userId] || 0) + buyIn;
        }
        saveData(balancesPath, bals);
        activeTournament = null;
        message.channel.send(`🃏 not enough players showed up. buy-in refunded. 🥛`).catch(() => {});
        return;
      }

      startTournament();
    }, JOIN_WINDOW);
  },
};
