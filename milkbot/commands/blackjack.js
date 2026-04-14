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
  // Shuffle
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

// userId -> gameState
const activeGames = new Map();

function buildGameMessage(game, status = 'playing') {
  const playerTotal = handTotal(game.playerHand);
  const dealerTotal = handTotal(game.dealerHand);

  let dealerDisplay;
  if (status === 'playing') {
    dealerDisplay = `${cardStr(game.dealerHand[0])} \`??\``;
  } else {
    dealerDisplay = `${handStr(game.dealerHand)} *(${dealerTotal})*`;
  }

  const playerDisplay = `${handStr(game.playerHand)} *(${playerTotal})*`;

  let lines = [
    `🃏 **BLACKJACK** | Bet: **${game.bet} milk bucks**`,
    ``,
    `🤖 **Dealer:** ${dealerDisplay}`,
    `👤 **You:** ${playerDisplay}`,
    ``,
  ];

  if (status === 'playing') {
    lines.push(`*${game.quip}*`);
    lines.push(``);
    lines.push(`Type \`hit\` or \`stand\` *(30s to act)*`);
  } else {
    lines.push(`*${game.quip}*`);
    if (game.resultLine) {
      lines.push(``);
      lines.push(game.resultLine);
    }
  }

  return lines.join('\n');
}

function resolveGame(userId, channel, gameMsg) {
  const game = activeGames.get(userId);
  if (!game) return;
  clearTimeout(game.timeout);
  activeGames.delete(userId);

  const playerTotal = handTotal(game.playerHand);

  // Dealer plays out
  while (handTotal(game.dealerHand) < 17) {
    game.dealerHand.push(game.deck.pop());
  }

  const dealerTotal = handTotal(game.dealerHand);
  const dealerBJ = isBlackjack(game.dealerHand);

  const balances = getData(balancesPath);
  const xp = getData(xpPath);
  let xpGain = 0;
  let resultLine = '';
  let newStreak = 0;

  if (dealerBJ && !isBlackjack(game.playerHand)) {
    // Dealer blackjack, player loses
    ws.resetStreak(userId);
    jackpot.addToJackpot(game.bet);
    game.quip = randQuip(DEALER_BLACKJACK_QUIPS);
    resultLine = `You lose **${game.bet} milk bucks**. Balance: **${balances[userId] || 0}** 🥛`;
    ach.check(userId, game.username, 'game_loss', { gameType: 'blackjack', balance: balances[userId] || 0 }, channel);
  } else if (dealerTotal > 21) {
    // Dealer busts
    newStreak = ws.recordWin(userId);
    const hotMul = newStreak >= 3 ? 1.5 : 1;
    const pm = prestige.getMultiplier(userId);
    const winnings = Math.floor(game.bet * hotMul * pm);
    balances[userId] = (balances[userId] || 0) + game.bet + winnings;
    xpGain = Math.floor(Math.max(5, game.bet / 10) * (state.doubleXp ? 2 : 1) * hotMul * pm);
    xp[userId] = (xp[userId] || 0) + xpGain;
    game.quip = `dealer busts at ${dealerTotal}! 💥 ` + randQuip(WIN_QUIPS);
    const bonusesBust = [hotMul > 1 ? '🔥 1.5x streak' : '', pm > 1 ? `🌟 ${pm}x prestige` : ''].filter(Boolean).join(' · ');
    resultLine = `You win **${winnings} milk bucks**!${bonusesBust ? ` *(${bonusesBust})*` : ''} Balance: **${balances[userId]}** 🥛`;
  } else if (playerTotal > dealerTotal) {
    newStreak = ws.recordWin(userId);
    const hotMul = newStreak >= 3 ? 1.5 : 1;
    const pm = prestige.getMultiplier(userId);
    const winnings = Math.floor(game.bet * hotMul * pm);
    balances[userId] = (balances[userId] || 0) + game.bet + winnings;
    xpGain = Math.floor(Math.max(5, game.bet / 10) * (state.doubleXp ? 2 : 1) * hotMul * pm);
    xp[userId] = (xp[userId] || 0) + xpGain;
    game.quip = randQuip(WIN_QUIPS);
    const bonusesWin = [hotMul > 1 ? '🔥 1.5x streak' : '', pm > 1 ? `🌟 ${pm}x prestige` : ''].filter(Boolean).join(' · ');
    resultLine = `You win **${winnings} milk bucks**!${bonusesWin ? ` *(${bonusesWin})*` : ''} Balance: **${balances[userId]}** 🥛`;
  } else if (dealerTotal > playerTotal) {
    ws.resetStreak(userId);
    jackpot.addToJackpot(game.bet);
    game.quip = randQuip(LOSE_QUIPS);
    resultLine = `You lose **${game.bet} milk bucks**. Balance: **${balances[userId] || 0}** 🥛`;
    ach.check(userId, game.username, 'game_loss', { gameType: 'blackjack', balance: balances[userId] || 0 }, channel);
  } else {
    // Push
    balances[userId] = (balances[userId] || 0) + game.bet;
    game.quip = randQuip(PUSH_QUIPS);
    resultLine = `Bet returned. Balance: **${balances[userId]}** 🥛`;
  }

  saveData(balancesPath, balances);
  if (xpGain > 0) saveData(xpPath, xp);

  game.resultLine = resultLine;
  gameMsg.edit(buildGameMessage(game, 'done')).catch(() => {
    channel.send(buildGameMessage(game, 'done'));
  });

  if (newStreak >= 3) ws.announceStreak(channel, game.username, newStreak);

  if (newStreak > 0) {
    jackpot.tryJackpot(userId, game.username, channel);
    ach.check(userId, game.username, 'bj_win', { balance: balances[userId], xp: xpGain > 0 ? xp[userId] : undefined, streak: newStreak, bet: game.bet, gameType: 'blackjack' }, channel);
  }
}

function check(message) {
  if (message.author.bot) return false;
  const game = activeGames.get(message.author.id);
  if (!game) return false;

  const content = message.content.trim().toLowerCase();
  if (content !== 'hit' && content !== 'stand') return false;

  clearTimeout(game.timeout);

  if (content === 'hit') {
    game.playerHand.push(game.deck.pop());
    const total = handTotal(game.playerHand);
    game.quip = randQuip(HIT_QUIPS);

    if (total > 21) {
      // Bust
      activeGames.delete(message.author.id);
      ws.resetStreak(message.author.id);
      jackpot.addToJackpot(game.bet);
      game.quip = randQuip(BUST_QUIPS);
      const bustBalance = getData(balancesPath)[message.author.id] || 0;
      game.resultLine = `You lose **${game.bet} milk bucks**. Bust at **${total}**. Balance: **${bustBalance}** 🥛`;

      // Dealer reveal for bust
      while (handTotal(game.dealerHand) < 17) {
        game.dealerHand.push(game.deck.pop());
      }

      game.gameMsg.edit(buildGameMessage(game, 'done')).catch(() => {
        message.channel.send(buildGameMessage(game, 'done'));
      });
      ach.check(message.author.id, game.username, 'bj_bust', { bet: game.bet, balance: bustBalance }, message.channel);
      return true;
    }

    if (total === 21) {
      // Auto-stand at 21
      game.quip = `hit 21! now let's see the dealer...`;
      game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
      setTimeout(() => resolveGame(message.author.id, message.channel, game.gameMsg), 1500);
      return true;
    }

    game.timeout = setTimeout(() => {
      activeGames.delete(message.author.id);
      jackpot.addToJackpot(game.bet);
      game.quip = `timed out. the dealer takes your milk bucks for the inactivity.`;
      game.resultLine = `You lose **${game.bet} milk bucks** (timeout). 🥛`;
      game.gameMsg.edit(buildGameMessage(game, 'done')).catch(() => {});
      ach.check(message.author.id, game.username, 'bj_timeout', { bet: game.bet }, message.channel);
    }, ACTION_TIMEOUT);

    game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
  } else {
    // Stand
    game.quip = randQuip(STAND_QUIPS);
    game.gameMsg.edit(buildGameMessage(game, 'playing')).catch(() => {});
    setTimeout(() => resolveGame(message.author.id, message.channel, game.gameMsg), 1500);
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
      return message.reply(`You're already in a game! Type \`hit\` or \`stand\`. 🃏`);
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
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    // Check for player blackjack
    if (isBlackjack(playerHand)) {
      const dealerBJ = isBlackjack(dealerHand);
      let quip, resultLine;
      let xpGain = 0;

      if (dealerBJ) {
        // Push — both blackjack
        balances[userId] = (balances[userId] || 0) + bet;
        saveData(balancesPath, balances);
        quip = `both blackjack. the universe is balanced. 🃏`;
        resultLine = `Push — bet returned. Balance: **${balances[userId]}** 🥛`;
      } else {
        // Player blackjack wins 3:2
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
        jackpot.tryJackpot(userId, message.author.username, message.channel);
        ach.check(userId, message.author.username, 'blackjack_natural', { balance: balances[userId], xp: xp[userId], streak: newStreak, gameType: 'blackjack' }, message.channel);
        ach.check(userId, message.author.username, 'bj_win', { balance: balances[userId], xp: xp[userId], streak: newStreak, bet, gameType: 'blackjack' }, message.channel);
      }

      const instantGame = { playerHand, dealerHand, bet, quip, resultLine, deck };
      message.channel.send(buildGameMessage(instantGame, 'done'));
      return;
    }

    const quip = randQuip(DEAL_QUIPS);
    const game = { playerHand, dealerHand, deck, bet, quip, gameMsg: null, timeout: null, resultLine: null, username: message.author.username };

    const timeout = setTimeout(() => {
      if (!activeGames.has(userId)) return;
      activeGames.delete(userId);
      game.quip = `you went ghost. dealer keeps your milk bucks. 👻`;
      game.resultLine = `You lose **${bet} milk bucks** (timeout). 🥛`;
      // Reveal dealer
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
  }
};
