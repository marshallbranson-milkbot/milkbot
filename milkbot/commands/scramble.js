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

  const SCRAMBLE_TIME = 15000;
  const RARE_SCRAMBLE_TIME = 25000;

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
    'bounty', 'outpost', 'raider', 'smuggler', 'convoy', 'ambush',
    'blaster', 'warrior', 'paladin', 'samurai', 'ninja', 'console',
    'joystick', 'respawn', 'stamina', 'tavern', 'citadel', 'barracks',
    'patrol', 'stealth', 'assault', 'pistol', 'shotgun', 'dagger',
    'spear', 'vampire', 'zombie', 'skeleton', 'wraith', 'golem',
    'phoenix', 'griffin', 'hydra', 'chimera', 'titan', 'vortex',
    'nebula', 'pulsar', 'comet', 'orbit', 'volcano', 'tundra',
    'plateau', 'ravine', 'compass', 'voyage', 'harbor', 'galleon',
    'cipher', 'laser', 'plasma', 'turbo', 'specter', 'oracle',
    'shaman', 'rogue', 'bandit', 'outlaw', 'marshal', 'champion',
    'trench', 'rampart', 'sentry', 'musket', 'pendant', 'relic',
    'mythic', 'heroic', 'savage', 'frenzy', 'mayhem', 'typhoon',
    'cyclone', 'tsunami', 'inferno', 'scorched', 'pilgrim', 'nomad',
    'warlock', 'druid', 'templar', 'crusader', 'spartan', 'legion',
  ];

  const rareWords = [
    'archipelago', 'byzantine', 'catacombs', 'subterfuge', 'quasar',
    'sarcophagus', 'labyrinth', 'phenomenon', 'clandestine', 'mercenary',
    'phosphorus', 'algorithm', 'cryptogram', 'obsidian', 'stratagem',
    'pyroclastic', 'leviathan', 'juggernaut', 'sovereignty', 'equilibrium',
    'contraband', 'insurgent', 'trajectory', 'catastrophe', 'necromancer',
    'behemoth', 'colosseum', 'mausoleum', 'purgatory', 'inquisition',
    'fluorescent', 'kaleidoscope', 'bureaucracy', 'hallucination', 'metamorphosis',
    'reconnaissance', 'conglomerate', 'infrastructure', 'perpendicular', 'incandescent',
    'miscellaneous', 'camouflage', 'flabbergasted', 'discombobulate', 'onomatopoeia',
    'perseverance', 'accomplishment', 'exhilaration', 'subterranean', 'dilapidated',
    'melancholy', 'philosophical', 'pandemonium', 'serendipity', 'turbulence',
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

    // Delete every guess attempt immediately
    message.delete().catch(() => {});

    // Already guessed — silently consumed
    if (activeScramble.guessed.has(message.author.id)) return true;

    activeScramble.guessed.add(message.author.id);

    if (guess === activeScramble.word.toLowerCase()) {
      const newStreak = ws.recordWin(message.author.id);
      const hotMultiplier = newStreak >= 3 ? 1.5 : 1;
      const pm = prestige.getMultiplier(message.author.id);
      const reward = Math.floor(activeScramble.reward * hotMultiplier * pm);
      const xpGain = Math.floor((activeScramble.rare ? 25 : 5) * (state.doubleXp ? 2 : 1) * hotMultiplier * pm);
      const rare = activeScramble.rare;
      const responseMs = Date.now() - activeScramble.startedAt;

      const balances = getData(balancesPath);
      balances[message.author.id] = Math.min(10_000_000, (balances[message.author.id] || 0) + reward);
      saveData(balancesPath, balances);

      const xp = getData(xpPath);
      xp[message.author.id] = (xp[message.author.id] || 0) + xpGain;
      saveData(xpPath, xp);

      clearTimeout(activeScramble.timeout);
      const questionMsg = activeScramble.questionMsg;
      activeScramble = null;

      if (questionMsg) setTimeout(() => questionMsg.delete().catch(() => {}), 6000);

      if (newStreak >= 3) ws.announceStreak(message.channel, message.author.username, newStreak);
      jackpot.tryJackpot(message.author.id, message.author.username, message.channel);

      ach.check(message.author.id, message.author.username, 'scramble_win', { balance: balances[message.author.id], xp: xp[message.author.id], streak: newStreak, responseMs, isRare: rare, gameType: 'scramble' }, message.channel);

      const bonuses = [hotMultiplier > 1 ? '🔥 1.5x streak' : '', pm > 1 ? `🌟 ${pm}x prestige` : ''].filter(Boolean).join(' · ');
      const winMsg = message.channel.send(
        `${rare ? '💎 **RARE WORD!**' : '✅'} **${message.author.username} got it!** The word was **${guess}**.\n` +
        `They earned **${reward} milk bucks**!` + (bonuses ? ` *(${bonuses})*` : '') + ` 🥛`
      );
      winMsg.then(m => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
      return true;
    }

    ws.resetStreak(message.author.id);
    return true;
  }

  module.exports = {
    name: 'sc',
    description: 'Unscramble the word to win milk bucks.',
    check,
    async execute(message) {
      if (activeScramble) return; // already active, silently ignore

      const isRare = Math.random() < 0.10;
      const wordPool = isRare ? rareWords : normalWords;
      const word = wordPool[Math.floor(Math.random() * wordPool.length)];
      const scrambled = scrambleWord(word);
      const reward = isRare ? word.length * 10 : word.length * 3;
      const guessed = new Set();

      const timeout = setTimeout(() => {
        if (!activeScramble) return;
        const qMsg = activeScramble.questionMsg;
        activeScramble = null;
        const timeoutMsg = message.channel.send(`⏰ Time's up! The word was **${word.toLowerCase()}**. Nobody got it. 🥛`);
        timeoutMsg.then(m => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
        if (qMsg) setTimeout(() => qMsg.delete().catch(() => {}), 6000);
      }, isRare ? RARE_SCRAMBLE_TIME : SCRAMBLE_TIME);

      activeScramble = { word, scrambled, reward, rare: isRare, guessed, timeout, startedAt: Date.now(), questionMsg: null };
      jackpot.addToJackpot(10);

      activeScramble.questionMsg = await message.channel.send(
        `${isRare ? '💎 **RARE WORD — BIG PAYOUT!**' : '🔤 **SCRAMBLE**'} 🔤\n` +
        `Unscramble this word: **${scrambled.toLowerCase()}**\n` +
        `Just type your answer in chat. First correct answer wins **${reward} milk bucks**!\n` +
        `You have **${isRare ? '25' : '15'} seconds**. ⏳`
      ).catch(() => null);
    }
  };