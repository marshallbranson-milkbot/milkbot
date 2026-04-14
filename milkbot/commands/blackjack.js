const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');
const ws = require('../winstreak');
const ach = require('../achievements');
const jackpot = require('../jackpot');
const prestige = require('../prestige');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const MIN_BET = 25;
const ACTION_TIMEOUT = 30000;

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const DEAL_QUIPS = [
  "alright, let's see what the milk gods blessed you with.",
  "fresh deck, straight from the udder.",
  "cards are dealt. try not to embarrass yourself.",
  "the milk is poured. will you drink wisely?",
  "i shuffled with my hooves. you're welcome.",
  "dealer's ready. your move, big spender.",
  "let's get this dairy duel started.",
  "i've dealt worse hands. actually no i haven't.",
];

const HIT_QUIPS = [
  "bold move. let's see how that ages.",
  "another card? you sure about that?",
  "hitting again? respect the chaos.",
  "one more card coming right up. no refunds.",
  "greedy. i like it.",
  "the milk must flow.",
  "you hit like someone who knows something i don't.",
  "fine. here's your card. don't blame me.",
];

const STAND_QUIPS = [
  "standing pat. classic milk energy.",
  "coward. i mean... strategic.",
  "okay okay, you're done. let's see what happens.",
  "standing at that? bold. very bold.",
  "the nerve to stand there. respect.",
  "dealer's turn. brace yourself.",
  "alright, you've made your bed.",
  "a stand at that value? the audacity.",
];

const BUST_QUIPS = [
  "BUSTED. the milk has curdled.",
  "over 21. went too greedy, huh?",
  "boom. busted. the house drinks your milk.",
  "called it. well, i didn't. but i thought it.",
  "the cards giveth, the cards taketh away.",
  "that's a bust baby. pour one out.",
  "too much milk. you exploded.",
  "21 is the limit. you forgot that apparently.",
];

const WIN_QUIPS = [
  "you beat the dealer. milk bucks secured. 🥛",
  "winner winner milk dinner.",
  "the dairy gods smiled upon you today.",
  "impressive. slightly. here's your milk bucks.",
  "you win. don't let it go to your head.",
  "can't believe you pulled that off. respect.",
  "the milk flows to the victorious.",
  "alright fine. you win this one.",
];

const LOSE_QUIPS = [
  "dealer wins. the milk bucks stay with me.",
  "better luck next udder.",
  "you lose. it happens to the best of us.",
  "the house always drinks. remember that.",
  "tough break. try again.",
  "not today. maybe tomorrow. probably not.",
  "the dealer collects. as always.",
  "this is why you shouldn't gamble. (but do it again)",
];

const PUSH_QUIPS = [
  "it's a tie. nobody wins, nobody loses. boring.",
  "push. the milk just... sits there.",
  "dead heat. the universe is indifferent to your fate.",
  "tie game. your milk bucks return to you.",
  "a draw. frankly embarrassing for both of us.",
  "push. same energy as lukewarm milk.",
];

const BLACKJACK_QUIPS = [
  "BLACKJACK!!! 🃏 the milk gods have SPOKEN.",
  "BLACKJACK! paying out 3:2. you absolute legend.",
  "NAT 21 BABY. the dairy jackpot!",
  "blackjack. i hate you. here's your milk bucks.",
  "BLACKJACK!!! first two cards, maximum glory. 🥛",
];

const DEALER_BLACKJACK_QUIPS = [
  "dealer blackjack. sorry not sorry. 🃏",
  "nat 21 for the house. the milk was never yours.",
  "dealer hits blackjack. the dairy gods play favorites.",
  "blackjack for me. rough start for you.",
];

const DOUBLE_QUIPS = [
  "doubling down? absolute chaos. one card coming.",
  "ballsy move. here's your one card. no backsies.",
  "double down committed. one card, that's it.",
  "the milk bucks are on the line. one. card.",
  "doubled. the universe will decide your fate.",
];

const SPLIT_QUIPS = [
  "SPLIT! two hands of chaos for double the price.",
  "splitting the herd. twice the glory, twice the suffering.",
  "two hands now. the milk gods will judge you on both.",
  "split! let's see what you're working with.",
];

function randQuip(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardStr(card) {
  return `\`${card.rank}${card.suit}\``;
}

function handStr(hand) {
  return hand.map(cardStr).join(' ');
}

function cardValue(rank) {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
}

function handTotal(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handTotal(hand) === 21;
}

function canSplit(cards) {
  return cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank);
}

// userId -> gameState
const activeGames = new Map();

// Returns available action strings for the current hand
function getActions(game) {
  const hand = game.hands[game.currentHandIndex];
  const actions = ['hit', 'stand'];
  if (hand.cards.length === 2) {
    const bal = getData(balancesPath)[game.userId] || 0;
    if (bal >= hand.bet) actions.push('double');
    if (game.hands.length === 1 && canSplit(hand.cards) && bal >= hand.bet) actions.push('split');
  }
  return actions;
}

function buildGameMessage(game, status = 'playing') {
  const isSplit = game.hands.length > 1;
  const totalBet = game.hands.reduce((s, h) => s + h.bet, 0);
  const dealerTotal = handTotal(game.dealerHand);

  const dealerDisplay = status === 'playing'
    ? `${cardStr(game.dealerHand[0])} \`??\``
    : `${handStr(game.dealerHand)} *(${dealerTotal})*`;

  const lines = [
    `🃏 **BLACKJACK** | Bet: **${totalBet} milk bucks**`,
    ``,
    `🤖 **Dealer:** ${dealerDisplay}`,
    ``,
  ];

  if (!isSplit) {
    const hand = game.hands[0];
    const total = handTotal(hand.cards);
    const ddStr = hand.doubledDown ? ' *[2x bet]*' : '';
    lines.push(`👤 **You:** ${handStr(hand.cards)} *(${total})*${ddStr}`);
  } else {
    for (let i = 0; i < game.hands.length; i++) {
      const hand = game.hands[i];
      const total = handTotal(hand.cards);
      const isActive = status === 'playing' && i === game.currentHandIndex && !hand.done;
      const arrow = isActive ? '▶' : '\u00a0\u00a0';
      const ddStr = hand.doubledDown ? ' *[2x]*' : '';
      const resultStr = hand.result ? ` — **${hand.result}**` : '';
      lines.push(`${arrow} **Hand ${i + 1}** (${hand.bet}mb)${ddStr}: ${handStr(hand.cards)} *(${total})*${resultStr}`);
    }
  }

  lines.push(``);
  lines.push(`*${game.quip}*`);

  if (status === 'playing') {
    lines.push(``);
    const actions = getActions(game);
    lines.push(`Type ${actions.map(a => `\`${a}\``).join(' / ')} *(30s to act)*`);
  } else if (game.resultLine) {
    lines.push(``);
    lines.push(game.resultLine);
  }

  return lines.join('\n');
}

function resetHandTimeout(userId, channel, game) {
  clearTimeout(game.timeout);
  game.timeout = setTimeout(() => {
    if (!activeGames.has(userId)) return;
    activeGames.delete(userId);

    for (const hand of game.hands) {
      if (!hand.done) jackpot.addToJackpot(hand.bet);
    }

    const totalBet = game.hands.reduce((s, h) => s + h.bet, 0);
    const bal = getData(balancesPath)[userId] || 0;
    game.quip = `timed out. the dealer takes your milk bucks for the inactivity.`;
    game.resultLine = `You lose **${totalBet} milk bucks** (timeout). Balance: **${bal}** 🥛`;

    if (game.gameMsg) {
      game.gameMsg.edit(buildGameMessage(game, 'done')).catch(() => {});
    }
    ach.check(userId, game.username, 'bj_timeout', { bet: game.hands[0].bet }, channel);
  }, ACTION_TIMEOUT);
}

function advanceOrResolve(userId, channel, gameMsg, game) {
  const nextIdx = game.hands.findIndex((h, i) => i > game.currentHandIndex && !h.done);

  if (nextIdx !== -1) {
    game.currentHandIndex = nextIdx;
    const nextHand = game.hands[nextIdx];

    // Auto-stand if the newly-active hand is already 21
    if (handTotal(nextHand.cards) === 21) {
      nextHand.done = true;
      game.quip = `hand ${nextIdx + 1} is 21 — automatic stand!`;
      gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
      setTimeout(() => advanceOrResolve(userId, channel, gameMsg, game), 1200);
      return;
    }

    game.quip = `now playing hand ${nextIdx + 1} — your move.`;
    resetHandTimeout(userId, channel, game);
    gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
  } else {
    setTimeout(() => resolveAllHands(userId, channel, gameMsg), 1200);
  }
}

function resolveAllHands(userId, channel, gameMsg) {
  const game = activeGames.get(userId);
  if (!game) return;
  clearTimeout(game.timeout);
  activeGames.delete(userId);

  // Dealer plays out
  while (handTotal(game.dealerHand) < 17) {
    game.dealerHand.push(game.deck.pop());
  }

  const dealerTotal = handTotal(game.dealerHand);
  const dealerBJ = isBlackjack(game.dealerHand);

  const balances = getData(balancesPath);
  const xp = getData(xpPath);
  const pm = prestige.getMultiplier(userId);

  // Categorize each hand result
  const handResults = game.hands.map(hand => {
    const pt = handTotal(hand.cards);
    if (pt > 21) return 'bust';
    if (dealerBJ && !isBlackjack(hand.cards)) return 'dealer_bj';
    if (dealerTotal > 21) return 'dealer_bust';
    if (pt > dealerTotal) return 'win';
    if (pt < dealerTotal) return 'loss';
    return 'push';
  });

  const handsWon = handResults.filter(r => r === 'win' || r === 'dealer_bust').length;
  const handsLost = handResults.filter(r => r === 'bust' || r === 'dealer_bj' || r === 'loss').length;
  const handsPushed = handResults.filter(r => r === 'push').length;

  // Determine streak direction
  let newStreak = 0;
  if (handsWon > 0) {
    newStreak = ws.recordWin(userId);
  } else if (handsLost > 0 && handsPushed === 0) {
    ws.resetStreak(userId);
  }

  const hotMul = newStreak >= 3 ? 1.5 : 1;

  let totalNetWin = 0;
  let totalXpGain = 0;

  for (let i = 0; i < game.hands.length; i++) {
    const hand = game.hands[i];
    const result = handResults[i];
    const pt = handTotal(hand.cards);

    if (result === 'bust') {
      jackpot.addToJackpot(hand.bet);
      hand.result = `bust (${pt})`;
      totalNetWin -= hand.bet;
      ach.check(userId, game.username, 'bj_bust', { bet: hand.bet, balance: balances[userId] || 0 }, channel);
    } else if (result === 'dealer_bj') {
      jackpot.addToJackpot(hand.bet);
      hand.result = `dealer BJ`;
      totalNetWin -= hand.bet;
    } else if (result === 'win' || result === 'dealer_bust') {
      const winnings = Math.floor(hand.bet * hotMul * pm);
      balances[userId] = (balances[userId] || 0) + hand.bet + winnings;
      const xpGain = Math.floor(Math.max(5, hand.bet / 10) * (state.doubleXp ? 2 : 1) * hotMul * pm);
      xp[userId] = (xp[userId] || 0) + xpGain;
      totalXpGain += xpGain;
      totalNetWin += winnings;
      hand.result = result === 'dealer_bust' ? `dealer bust +${winnings}mb` : `win +${winnings}mb`;
    } else if (result === 'loss') {
      jackpot.addToJackpot(hand.bet);
      hand.result = `loss`;
      totalNetWin -= hand.bet;
    } else {
      // push
      balances[userId] = (balances[userId] || 0) + hand.bet;
      hand.result = `push`;
    }
  }

  saveData(balancesPath, balances);
  if (totalXpGain > 0) saveData(xpPath, xp);

  const finalBalance = balances[userId] || 0;
  const bonuses = [hotMul > 1 ? '🔥 1.5x streak' : '', pm > 1 ? `🌟 ${pm}x prestige` : ''].filter(Boolean).join(' · ');
  const isSplit = game.hands.length > 1;

  let quip, resultLine;

  if (isSplit) {
    if (totalNetWin > 0) {
      quip = randQuip(WIN_QUIPS);
      resultLine = `Split net: **+${totalNetWin} milk bucks**${bonuses ? ` *(${bonuses})*` : ''}! Balance: **${finalBalance}** 🥛`;
    } else if (totalNetWin < 0) {
      quip = randQuip(LOSE_QUIPS);
      resultLine = `Split net: **-${Math.abs(totalNetWin)} milk bucks**. Balance: **${finalBalance}** 🥛`;
    } else {
      quip = randQuip(PUSH_QUIPS);
      resultLine = `Split break even. Balance: **${finalBalance}** 🥛`;
    }
  } else {
    const result = handResults[0];
    const hand = game.hands[0];
    const pt = handTotal(hand.cards);

    if (result === 'bust') {
      quip = randQuip(BUST_QUIPS);
      resultLine = `You lose **${hand.bet} milk bucks**. Bust at **${pt}**. Balance: **${finalBalance}** 🥛`;
    } else if (result === 'dealer_bj') {
      quip = randQuip(DEALER_BLACKJACK_QUIPS);
      resultLine = `You lose **${hand.bet} milk bucks**. Balance: **${finalBalance}** 🥛`;
    } else if (result === 'dealer_bust') {
      quip = `dealer busts at ${dealerTotal}! 💥 ` + randQuip(WIN_QUIPS);
      resultLine = `You win **${totalNetWin} milk bucks**!${bonuses ? ` *(${bonuses})*` : ''} Balance: **${finalBalance}** 🥛`;
    } else if (result === 'win') {
      quip = randQuip(WIN_QUIPS);
      resultLine = `You win **${totalNetWin} milk bucks**!${bonuses ? ` *(${bonuses})*` : ''} Balance: **${finalBalance}** 🥛`;
    } else if (result === 'loss') {
      quip = randQuip(LOSE_QUIPS);
      resultLine = `You lose **${hand.bet} milk bucks**. Balance: **${finalBalance}** 🥛`;
    } else {
      quip = randQuip(PUSH_QUIPS);
      resultLine = `Bet returned. Balance: **${finalBalance}** 🥛`;
    }
  }

  game.quip = quip;
  game.resultLine = resultLine;

  gameMsg.edit(buildGameMessage(game, 'done')).catch(() => {
    channel.send(buildGameMessage(game, 'done'));
  });

  if (newStreak >= 3) ws.announceStreak(channel, game.username, newStreak);

  if (newStreak > 0) {
    jackpot.tryJackpot(userId, game.username, channel);
    ach.check(userId, game.username, 'bj_win', {
      balance: finalBalance,
      xp: totalXpGain > 0 ? xp[userId] : undefined,
      streak: newStreak,
      bet: game.hands[0].bet,
      gameType: 'blackjack',
    }, channel);
  }

  if (handsLost > 0 && handsWon === 0) {
    ach.check(userId, game.username, 'game_loss', { gameType: 'blackjack', balance: finalBalance }, channel);
  }
}

function check(message) {
  if (message.author.bot) return false;
  const game = activeGames.get(message.author.id);
  if (!game) return false;

  const content = message.content.trim().toLowerCase();
  if (!['hit', 'stand', 'double', 'split'].includes(content)) return false;

  clearTimeout(game.timeout);

  const userId = message.author.id;
  const hand = game.hands[game.currentHandIndex];

  if (content === 'hit') {
    hand.cards.push(game.deck.pop());
    const total = handTotal(hand.cards);

    if (total > 21) {
      hand.done = true;
      game.quip = randQuip(BUST_QUIPS);
      game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
      setTimeout(() => advanceOrResolve(userId, message.channel, game.gameMsg, game), 1200);
      return true;
    }

    if (total === 21) {
      hand.done = true;
      game.quip = game.hands.length > 1
        ? `hand ${game.currentHandIndex + 1} hits 21 — auto stand!`
        : `hit 21! now let's see the dealer...`;
      game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
      setTimeout(() => advanceOrResolve(userId, message.channel, game.gameMsg, game), 1200);
      return true;
    }

    game.quip = randQuip(HIT_QUIPS);
    resetHandTimeout(userId, message.channel, game);
    game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});

  } else if (content === 'stand') {
    hand.done = true;
    game.quip = randQuip(STAND_QUIPS);
    game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
    setTimeout(() => advanceOrResolve(userId, message.channel, game.gameMsg, game), 1200);

  } else if (content === 'double') {
    // Double only available on first action (2 cards)
    if (hand.cards.length !== 2) {
      resetHandTimeout(userId, message.channel, game);
      return true;
    }

    const balances = getData(balancesPath);
    const bal = balances[userId] || 0;
    if (bal < hand.bet) {
      message.reply(`Not enough milk bucks to double! You need **${hand.bet}** more. 🥛`);
      resetHandTimeout(userId, message.channel, game);
      return true;
    }

    // Deduct extra bet
    balances[userId] = bal - hand.bet;
    saveData(balancesPath, balances);
    hand.bet *= 2;
    hand.doubledDown = true;

    // One card only, then auto-stand
    hand.cards.push(game.deck.pop());
    hand.done = true;

    const total = handTotal(hand.cards);
    game.quip = total > 21
      ? randQuip(DOUBLE_QUIPS) + ` ...and busted at ${total}. ouch.`
      : randQuip(DOUBLE_QUIPS);

    game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
    setTimeout(() => advanceOrResolve(userId, message.channel, game.gameMsg, game), 1200);

  } else if (content === 'split') {
    // Only allowed on first hand, matching card values, not already split
    if (game.hands.length > 1 || !canSplit(hand.cards)) {
      resetHandTimeout(userId, message.channel, game);
      return true;
    }

    const balances = getData(balancesPath);
    const bal = balances[userId] || 0;
    if (bal < hand.bet) {
      message.reply(`Not enough milk bucks to split! You need **${hand.bet}** more. 🥛`);
      resetHandTimeout(userId, message.channel, game);
      return true;
    }

    // Deduct second hand bet
    balances[userId] = bal - hand.bet;
    saveData(balancesPath, balances);

    const originalBet = hand.bet;
    const [card1, card2] = hand.cards;

    // Each split hand: original card + one fresh card
    game.hands = [
      { cards: [card1, game.deck.pop()], bet: originalBet, doubledDown: false, done: false, result: null },
      { cards: [card2, game.deck.pop()], bet: originalBet, doubledDown: false, done: false, result: null },
    ];
    game.currentHandIndex = 0;

    // Auto-stand if hand 1 hit 21 on the deal
    if (handTotal(game.hands[0].cards) === 21) {
      game.hands[0].done = true;
      game.quip = randQuip(SPLIT_QUIPS) + ` hand 1 hits 21 instantly!`;
      resetHandTimeout(userId, message.channel, game);
      game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
      setTimeout(() => advanceOrResolve(userId, message.channel, game.gameMsg, game), 1200);
    } else {
      game.quip = randQuip(SPLIT_QUIPS);
      resetHandTimeout(userId, message.channel, game);
      game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
    }
  }

  return true;
}

module.exports = {
  name: 'bl',
  aliases: ['blackjack'],
  description: 'Play blackjack against MilkBot. Min bet 25 milk bucks.',
  check,
  execute(message, args) {
    const userId = message.author.id;

    if (activeGames.has(userId)) {
      return message.reply(`You're already in a game! Type \`hit\`, \`stand\`, \`double\`, or \`split\`. 🃏`);
    }

    const bet = parseInt(args[0]);
    if (!bet || isNaN(bet) || bet < MIN_BET) {
      return message.reply(`Minimum bet is **${MIN_BET} milk bucks**. Usage: \`!bl amount\` 🥛`);
    }

    const balances = getData(balancesPath);
    const balance = balances[userId] || 0;
    if (balance < bet) {
      return message.reply(`You need **${bet} milk bucks** to bet that. You've got **${balance}**. 🥛`);
    }

    // Deduct bet upfront
    balances[userId] = balance - bet;
    saveData(balancesPath, balances);

    const deck = buildDeck();
    const playerCards = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];
    const hands = [{ cards: playerCards, bet, doubledDown: false, done: false, result: null }];

    // Instant resolve on player natural blackjack
    if (isBlackjack(playerCards)) {
      const dealerBJ = isBlackjack(dealerHand);
      let quip, resultLine;
      let xpGain = 0;

      if (dealerBJ) {
        balances[userId] = (balances[userId] || 0) + bet;
        saveData(balancesPath, balances);
        quip = `both blackjack. the universe is balanced. 🃏`;
        resultLine = `Push — bet returned. Balance: **${balances[userId]}** 🥛`;
      } else {
        const bjPayout = Math.floor(bet * 1.5);
        const newStreak = ws.recordWin(userId);
        const hotMul = newStreak >= 3 ? 1.5 : 1;
        const pm = prestige.getMultiplier(userId);
        const winnings = Math.floor(bjPayout * hotMul * pm);
        balances[userId] = (balances[userId] || 0) + bet + winnings;
        xpGain = Math.floor(Math.max(10, bet / 5) * (state.doubleXp ? 2 : 1) * hotMul * pm);
        const xp = getData(xpPath);
        xp[userId] = (xp[userId] || 0) + xpGain;
        saveData(xpPath, xp);
        saveData(balancesPath, balances);
        quip = randQuip(BLACKJACK_QUIPS);
        const bonusesBJ = [hotMul > 1 ? '🔥 1.5x streak' : '', pm > 1 ? `🌟 ${pm}x prestige` : ''].filter(Boolean).join(' · ');
        resultLine = `**Blackjack!** 3:2 payout — You win **${winnings} milk bucks**!${bonusesBJ ? ` *(${bonusesBJ})*` : ''} Balance: **${balances[userId]}** 🥛`;
        if (newStreak >= 3) ws.announceStreak(message.channel, message.author.username, newStreak);
        jackpot.tryJackpot(userId, message.author.username, message.channel);
        ach.check(userId, message.author.username, 'blackjack_natural', { balance: balances[userId], xp: xp[userId], streak: newStreak, gameType: 'blackjack' }, message.channel);
        ach.check(userId, message.author.username, 'bj_win', { balance: balances[userId], xp: xp[userId], streak: newStreak, bet, gameType: 'blackjack' }, message.channel);
      }

      const instantGame = { hands, dealerHand, quip, resultLine, deck };
      message.channel.send(buildGameMessage(instantGame, 'done'));
      return;
    }

    const quip = randQuip(DEAL_QUIPS);
    const game = {
      userId,
      hands,
      currentHandIndex: 0,
      dealerHand,
      deck,
      quip,
      gameMsg: null,
      timeout: null,
      resultLine: null,
      username: message.author.username,
    };

    const timeout = setTimeout(() => {
      if (!activeGames.has(userId)) return;
      activeGames.delete(userId);

      for (const h of game.hands) {
        if (!h.done) jackpot.addToJackpot(h.bet);
      }

      game.quip = `you went ghost. dealer keeps your milk bucks. 👻`;
      game.resultLine = `You lose **${bet} milk bucks** (timeout). 🥛`;
      while (handTotal(game.dealerHand) < 17) {
        game.dealerHand.push(game.deck.pop());
      }
      if (game.gameMsg) {
        game.gameMsg.edit(buildGameMessage(game, 'done')).catch(() => {});
      }
      ach.check(userId, game.username, 'bj_timeout', { bet }, message.channel);
    }, ACTION_TIMEOUT);

    game.timeout = timeout;
    activeGames.set(userId, game);

    message.channel.send(buildGameMessage(game, 'playing')).then(msg => {
      game.gameMsg = msg;
    }).catch(console.error);
  },
};
