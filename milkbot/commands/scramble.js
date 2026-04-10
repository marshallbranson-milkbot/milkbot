 const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');
const ws = require('../winstreak');
const ach = require('../achievements');

  function getData(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  const SCRAMBLE_TIME = 15000;

  const normalWords = [
    'discord', 'server', 'gaming', 'winner', 'chicken', 'laptop',
    'keyboard', 'monitor', 'headset', 'controller', 'stream', 'lobby',
    'victory', 'dragon', 'castle', 'wizard', 'potion', 'dungeon',
    'rocket', 'planet', 'galaxy', 'meteor', 'captain', 'pirate',
    'treasure', 'jungle', 'cobra', 'falcon', 'thunder', 'blizzard',
    'village', 'shield', 'archer', 'knight', 'goblin', 'phantom',
    'ranger', 'hunter', 'sniper', 'cannon', 'bridge', 'forest',
    'desert', 'frozen', 'portal', 'beacon', 'turret', 'bunker',
    'trophy', 'legend', 'rookie', 'veteran', 'mission', 'target',
    'shadow', 'hammer', 'bullet', 'grenade', 'helmet', 'armor',
    'magnet', 'crystal', 'temple', 'cursed', 'ancient', 'lantern',
    'engine', 'circuit', 'battery', 'gadget', 'signal', 'reactor',
    'summit', 'canyon', 'glacier', 'swamp', 'cavern', 'crater',
    'bounty', 'outpost', 'raider', 'smuggler', 'convoy', 'ambush'
  ];

  const rareWords = [
    'archipelago', 'byzantine', 'catacombs', 'subterfuge', 'quasar',
    'sarcophagus', 'labyrinth', 'phenomenon', 'clandestine', 'mercenary',
    'phosphorus', 'algorithm', 'cryptogram', 'obsidian', 'stratagem',
    'pyroclastic', 'leviathan', 'juggernaut', 'sovereignty', 'equilibrium',
    'contraband', 'insurgent', 'trajectory', 'catastrophe', 'necromancer',
    'behemoth', 'colosseum', 'mausoleum', 'purgatory', 'inquisition'
  ];

  function scrambleWord(word) {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const scrambled = arr.join('');
    return scrambled.toLowerCase() === word.toLowerCase() ? scrambleWord(word) : scrambled;
  }

  let activeScramble = null;

  function check(message) {
    if (!activeScramble) return false;
    if (message.content.startsWith('!')) return false;

    const guess = message.content.trim().toLowerCase();
    if (!guess) return false;

    if (activeScramble.guessed.has(message.author.id)) {
      message.reply("You already guessed this round. One shot per person. 🥛");
      return true;
    }

    activeScramble.guessed.add(message.author.id);

    if (guess === activeScramble.word.toLowerCase()) {
      const newStreak = ws.recordWin(message.author.id);
      const multiplier = newStreak >= 3 ? 1.5 : 1;
      const reward = Math.floor(activeScramble.reward * multiplier);
      const xpGain = Math.floor((activeScramble.rare ? 25 : 5) * (state.doubleXp ? 2 : 1) * multiplier);
      const rare = activeScramble.rare;

      const balances = getData(balancesPath);
      balances[message.author.id] = (balances[message.author.id] || 0) + reward;
      saveData(balancesPath, balances);

      const xp = getData(xpPath);
      xp[message.author.id] = (xp[message.author.id] || 0) + xpGain;
      saveData(xpPath, xp);

      clearTimeout(activeScramble.timeout);
      activeScramble = null;

      if (newStreak === 3) message.channel.send(`🔥 **${message.author.username} is on a HOT STREAK!** 3 wins in a row — 1.5x on everything! 🥛`);

      ach.check(message.author.id, message.author.username, rare ? 'rare_word' : 'game_win', { balance: balances[message.author.id], xp: xp[message.author.id], streak: newStreak }, message.channel);

      message.channel.send(
        `${rare ? '💎 **RARE WORD!**' : '✅'} **${message.author.username} got it!** The word was **${guess}**.\n` +
        `They earned **${reward} milk bucks**!` + (multiplier > 1 ? ` *(🔥 1.5x hot streak)*` : '') + ` 🥛`
      );
      return true;
    }

    ws.resetStreak(message.author.id);
    message.reply(`Nope. One guess per round — you're out. 🥛`);
    return true;
  }

  module.exports = {
    name: 'sc',
    description: 'Unscramble the word to win milk bucks.',
    check,
    execute(message) {
      if (activeScramble) {
        return message.reply(`A scramble is already active! The word is:
  **${activeScramble.scrambled.toLowerCase()}**`);
      }

      const isRare = Math.random() < 0.05;
      const wordPool = isRare ? rareWords : normalWords;
      const word = wordPool[Math.floor(Math.random() * wordPool.length)];
      const scrambled = scrambleWord(word);
      const reward = isRare ? word.length * 10 : word.length * 3;
      const guessed = new Set();

      const timeout = setTimeout(() => {
        if (activeScramble) {
          message.channel.send(`⏰ Time's up! The word was **${activeScramble.word.toLowerCase()}**. Nobody got it.
  🥛`);
          activeScramble = null;
        }
      }, SCRAMBLE_TIME);

      activeScramble = { word, scrambled, reward, rare: isRare, guessed, timeout };

      message.channel.send(
        `${isRare ? '💎 **RARE WORD — BIG PAYOUT!**' : '🔤 **SCRAMBLE**'} 🔤\n` +
        `Unscramble this word: **${scrambled.toLowerCase()}**\n` +
        `Just type your answer in chat. First correct answer wins **${reward} milk bucks**!\n` +
        `You have **15 seconds**. ⏳`
      );
    }
  };