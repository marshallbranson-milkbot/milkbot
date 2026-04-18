const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const state = require('../state');
const { getMultiplier, getLevelCap } = require('../prestige');

const GUILD_ID       = '562076997979865118';
const DATA_PATH      = path.join(__dirname, '../data/raidboss.json');
const BALANCES_PATH  = path.join(__dirname, '../data/balances.json');
const XP_PATH        = path.join(__dirname, '../data/xp.json');

const ATTACK_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const RISK_CHANCE     = 0.15;

function getLevel(totalXp, userId) {
  const cap = userId ? getLevelCap(userId) : 100;
  let level = 1, xpUsed = 0;
  while (true) {
    const needed = level * 100;
    if (xpUsed + needed > totalXp) break;
    xpUsed += needed;
    level++;
    if (level >= cap) return cap;
  }
  return level;
}

function rollDamage(userId) {
  const xpData = readXp();
  const level = getLevel(xpData[userId] || 0, userId);
  const base = 30 + level * 4; // level 1 → 34, level 50 → 230, level 100 → 430
  return Math.max(1, Math.floor(base * (0.8 + Math.random() * 0.4)));
}

const BOSSES = [
  {
    name: 'CROTA, SON OF CURD',
    art: [
      '   ☠️  ☠️  ☠️  ☠️  ☠️   ',
      ' ☠️🌑🌑🌑🌑🌑🌑🌑🌑🌑☠️ ',
      '☠️🌑🌑  🔴        🔴  🌑🌑☠️',
      '☠️🌑🌑     💀💀💀     🌑🌑☠️',
      '☠️🌑🌑  〰️〰️〰️〰️〰️  🌑🌑☠️',
      ' ☠️🌑🌑🌑🌑🌑🌑🌑🌑🌑☠️ ',
      ' ☠️🌑🛡️🛡️🌑🌑🛡️🛡️🌑☠️ ',
      '⚔️⚔️🌑🌑🌑🌑🌑🌑🌑🌑⚔️⚔️',
      ' 🥛 ⚔️🌑🌑🌑🌑🌑🌑⚔️ 🥛 ',
      '     ⚔️  🌑🌑🌑  ⚔️     ',
      '         🦴    🦴        ',
      '         👢    👢        ',
    ].join('\n'),
    lore: '"You will never escape the curd. I am the darkness in every fridge."',
  },
  {
    name: 'IR YUT, THE CHEESEINGER',
    art: [
      '  🎵  🎶    🎵  🎶  🎵  ',
      '  🟣🟣🟣🟣🟣🟣🟣🟣🟣  ',
      ' 🟣🌑  💜        💜  🌑🟣',
      ' 🟣🌑     😱😱😱     🌑🟣',
      ' 🟣🌑  〰️〰️〰️〰️〰️  🌑🟣',
      '  🟣🟣🟣🟣🟣🟣🟣🟣🟣  ',
      ' 🎵🟣  🟣🟣🟣🟣🟣  🟣🎵 ',
      '🥛  〰️〰️🟣🟣🟣🟣🟣〰️〰️  🥛',
      '    〰️〰️〰️〰️〰️〰️〰️    ',
      '      〰️    🎶    〰️    ',
      '    🎵    〰️〰️    🎵    ',
    ].join('\n'),
    lore: '"My song will curdle every drop in your body. Scream with me."',
  },
  {
    name: 'ORYX, THE TAKEN CREAM',
    art: [
      '🌑  🌑  🟣🟣🟣  🌑  🌑',
      '🌑🟣🟣🟣🟣🟣🟣🟣🟣🟣🌑',
      '🟣🟣  👁️🟣🟣🟣🟣👁️  🟣🟣',
      '🟣🟣    🟣🟣🟣🟣🟣    🟣🟣',
      '🟣🟣  ≋≋≋≋≋≋≋≋≋  🟣🟣',
      ' 🌑🟣🟣🟣🟣🟣🟣🟣🟣🌑 ',
      '🌑🌑🟣🟣🟣🟣🟣🟣🟣🟣🌑🌑',
      '🥛🌑🌑🟣🟣🟣🟣🟣🌑🌑🥛',
      '   🌑🌑  🟣🟣🟣  🌑🌑   ',
      '      🌑  🟣🟣  🌑      ',
      '        🌑    🌑        ',
    ].join('\n'),
    lore: '"I have taken the cream. I have taken the light. What remains is mine."',
  },
  {
    name: 'GOLGOROTH, BELLY OF BILE',
    art: [
      '  🟫🟫🟫🟫🟫🟫🟫🟫🟫  ',
      ' 🟫🌑  🔴        🔴  🌑🟫',
      ' 🟫🌑     👄👄👄     🌑🟫',
      ' 🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫 ',
      '🟫🌑🌑🌑🌑🌑🌑🌑🌑🌑🌑🟫',
      '🟫🌑🌑  💛💛💛💛💛  🌑🌑🟫',
      '🟫🌑  💛💛💛💛💛💛💛  🌑🟫',
      '🟫🌑🌑  💛💛💛💛💛  🌑🌑🟫',
      '🥛🟫🌑🌑🌑🌑🌑🌑🌑🌑🟫🥛',
      '   🟫🟫🌑🌑🌑🌑🌑🌑🟫🟫  ',
      '       🦵          🦵    ',
      '       🥛          🥛    ',
    ].join('\n'),
    lore: '"Hang upside down and look into my belly. That glow is your milk bucks. Gone."',
  },
  {
    name: 'THE WARPRIEST OF MALK',
    art: [
      '  ✨  💀  ✨  💀  ✨   ',
      '  🟣🟣🟣🟣🟣🟣🟣🟣🟣  ',
      ' 🟣🌑  🔮        🔮  🌑🟣',
      ' 🟣🌑     🌑🌑🌑     🌑🟣',
      ' 🟣🌑  〰️〰️〰️〰️〰️  🌑🟣',
      '  🟣🟣🟣🟣🟣🟣🟣🟣🟣  ',
      ' ✨🟣🟣🟣🟣🟣🟣🟣🟣✨  ',
      '🥛 🟣🟣🌑🌑🌑🌑🌑🟣🟣 🥛',
      '   🟣🟣  🔮  🔮  🟣🟣   ',
      '      💀      💀         ',
      '      🥛      🥛         ',
    ].join('\n'),
    lore: '"The ritual is complete. All milk returns to the Darkness. Drink nothing."',
  },
  {
    name: 'THE DAUGHTERS OF WHEY',
    art: [
      '✨🟣🟣🌑   ✨   🌑🟣🟣✨',
      '🟣🌑  💜  ✨  💜  🌑🟣',
      '🟣🌑  👁️       👁️  🌑🟣',
      '🟣🌑  〰️〰️〰️〰️〰️  🌑🟣',
      '🟣🟣🟣🌑   🌑   🌑🟣🟣🟣',
      '🥛🟣🟣🟣🟣🌑🟣🟣🟣🟣🥛',
      '   🟣🌑  🟣🌑🟣  🌑🟣   ',
      '    💜  🟣    🟣  💜    ',
      '      ✨        ✨       ',
      '      🥛        🥛      ',
    ].join('\n'),
    lore: '"Together we curdle. Apart we curdle. There is no outcome where you win."',
  },
  {
    name: 'THE LACTEAN',
    art: [
      '  🕐🕐  ♦️♦️♦️♦️♦️  🕐🕐  ',
      ' ♦️♦️♦️♦️♦️♦️♦️♦️♦️♦️♦️ ',
      '♦️♦️  🟩        🟩  ♦️♦️',
      '♦️♦️  🟩  👁️🟩👁️  🟩  ♦️♦️',
      '♦️♦️     🟩🟩🟩🟩🟩     ♦️♦️',
      '♦️♦️  〰️〰️〰️〰️〰️  ♦️♦️',
      ' ♦️♦️♦️♦️♦️♦️♦️♦️♦️♦️♦️ ',
      '🕐♦️♦️♦️🟩🟩🟩🟩🟩♦️♦️♦️🕐',
      '🥛  ♦️♦️♦️🟩🟩🟩♦️♦️♦️  🥛',
      '      ♦️  🕐  🕐  ♦️    ',
      '         ♦️    ♦️        ',
    ].join('\n'),
    lore: '"All timelines end in spoiled milk. I have seen them all. You always lose."',
  },
  {
    name: 'THE TEMPLAR OF TURNED MILK',
    art: [
      '   💧💧💧💧💧💧💧💧💧   ',
      '  🟩🟩🟩🟩🟩🟩🟩🟩🟩  ',
      ' 🟩🌑  🔵        🔵  🌑🟩',
      ' 🟩🌑     🌀🌀🌀     🌑🟩',
      ' 🟩🌑  〰️〰️〰️〰️〰️  🌑🟩',
      '  🟩🟩🟩🟩🟩🟩🟩🟩🟩  ',
      '💧🟩🟩🛡️🛡️🟩🛡️🛡️🟩🟩💧',
      '🥛🌀🟩🟩🟩🟩🟩🟩🟩🟩🌀🥛',
      '   🌀🟩🌀  🟩🟩  🌀🟩🌀   ',
      '      💧    💧    💧      ',
    ].join('\n'),
    lore: '"You cannot cleanse this vault. The milk turned long before you arrived."',
  },
  {
    name: 'SKOLAS THE SOUR',
    art: [
      '   ⚡   💜💜💜💜💜   ⚡   ',
      '  💜💜💜💜💜💜💜💜💜💜  ',
      ' 💜🌑  ⚡        ⚡  🌑💜 ',
      ' 💜🌑     😤😤😤     🌑💜 ',
      ' 💜🌑  〰️〰️〰️〰️〰️  🌑💜 ',
      '  💜💜💜💜💜💜💜💜💜💜  ',
      ' ⚡💜💜💜💜💜💜💜💜💜⚡  ',
      '🥛⚡💜🌑🌑🌑🌑🌑🌑💜⚡🥛',
      '    💜  ⚡    ⚡  💜     ',
      '         🦵    🦵        ',
      '         🥛    🥛        ',
    ].join('\n'),
    lore: '"I will never stop. I have escaped Prison of Milk four times. I will escape again."',
  },
  {
    name: 'AKSIS, SIVA DAIRY UNIT',
    art: [
      '  🔴🔴🔴🔴🔴🔴🔴🔴🔴  ',
      ' 🔴🌑🌑🌑🌑🌑🌑🌑🌑🌑🔴',
      '🔴🌑  🔴        🔴  🌑🔴',
      '🔴🌑  🔴  👾🔴👾  🔴  🌑🔴',
      '🔴🌑  🔴🔴🔴🔴🔴🔴🔴  🌑🔴',
      ' 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴 ',
      '🔴🌑🔴⚙️⚙️🌑⚙️⚙️🔴🌑🔴',
      '🥛🔴🌑🌑🔴🔴🔴🔴🌑🌑🔴🥛',
      '   🔴🌑  🔴    🔴  🌑🔴   ',
      '      ⚙️          ⚙️     ',
      '      🥛          🥛     ',
    ].join('\n'),
    lore: '"SIVA protocol: convert all dairy to nanomachines. Consume. Replicate. Spoil."',
  },
  {
    name: 'VOSIK THE CURDPRIEST',
    art: [
      '  🔴✨🔴✨🔴✨🔴✨🔴  ',
      ' 🔴🌑🌑🌑🌑🌑🌑🌑🌑🌑🔴',
      '🔴🌑  🔴        🔴  🌑🔴',
      '🔴🌑     🙏🙏🙏     🌑🔴',
      '🔴🌑  〰️〰️〰️〰️〰️  🌑🔴',
      ' 🔴🌑🌑🌑🌑🌑🌑🌑🌑🌑🔴 ',
      '✨🔴🌑🔴🔴🌑🌑🔴🔴🌑🔴✨',
      '🥛✨🔴🌑🌑🔴🔴🌑🌑🔴✨🥛',
      '    🔴  🔴    🔴  🔴     ',
      '         🦴    🦴        ',
      '         🥛    🥛        ',
    ].join('\n'),
    lore: '"I offer myself to the curd. I offer you as well. This was not a request."',
  },
  {
    name: 'THE SIEGE ENGINE OF MILK',
    art: [
      '⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️',
      '⚙️🌑🌑🌑🌑🌑🌑🌑🌑🌑⚙️',
      '⚙️🌑💥  🔴    🔴  💥🌑⚙️',
      '⚙️🌑💥  🔴  🎯🔴  💥🌑⚙️',
      '⚙️🌑🌑🌑🌑🌑🌑🌑🌑🌑⚙️',
      '⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️',
      '⚙️🥛⚙️🌑🌑🌑🌑🌑⚙️🥛⚙️',
      '⚙️⚙️🌑🌑💥💥💥🌑🌑⚙️⚙️',
      '⚙️🌑  🌑🌑🌑🌑🌑  🌑⚙️',
      '  ⚙️⚙️  ⚙️  ⚙️  ⚙️⚙️  ',
    ].join('\n'),
    lore: '"Runs on pure dairy fuel. Estimated range: your entire life. Estimated mercy: zero."',
  },
  {
    name: 'CALUS, DRINKER OF INFINITE MILK',
    art: [
      '   👑👑👑👑👑👑👑👑👑   ',
      '  🟡🟡🟡🟡🟡🟡🟡🟡🟡  ',
      ' 🟡🌑  🟡        🟡  🌑🟡',
      ' 🟡🌑     😏😏😏     🌑🟡',
      ' 🟡🌑  🥛🥛🥛🥛🥛  🌑🟡',
      '  🟡🟡🟡🟡🟡🟡🟡🟡🟡  ',
      ' 🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡 ',
      '🥛🟡🌑🌑🟡🟡🟡🟡🌑🌑🟡🥛',
      '  🥛🟡🌑🌑🟡🟡🌑🌑🟡🥛  ',
      '     🟡  🦵    🦵  🟡    ',
      '          👞  👞          ',
    ].join('\n'),
    lore: '"I have consumed more milk than this server will ever earn. Bring me more."',
  },
  {
    name: 'ARGOS, THE DAIRY CORE',
    art: [
      '   🟩🟩🟩🟩🟩🟩🟩🟩🟩   ',
      ' 🟩🟩🌑🌑🌑🌑🌑🌑🌑🟩🟩 ',
      '🟩🌑🌑  🟩🟩🟩🟩🟩  🌑🌑🟩',
      '🟩🌑  🟩🟩  👁️🟩👁️  🟩🟩  🌑🟩',
      '🟩🌑  🟩🟩🟩🟩🟩🟩🟩  🌑🟩',
      ' 🟩🟩🌑🌑🌑🌑🌑🌑🌑🟩🟩 ',
      '♦️🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩♦️',
      '🥛♦️🟩🟩🌑🌑🌑🌑🟩🟩♦️🥛',
      '    ♦️🟩🟩🟩🟩🟩🟩♦️    ',
      '       ♦️♦️♦️♦️♦️♦️       ',
    ].join('\n'),
    lore: '"Processing: 1 gallon = 4,096 data points. Your portfolio = insufficient. Deleting."',
  },
  {
    name: 'VAL CA\'UOR, DAIRY FLEET ADMIRAL',
    art: [
      '  🔴🔴🔴🔴🔴🔴🔴🔴🔴  ',
      ' 🔴🟤🟤🟤🟤🟤🟤🟤🟤🟤🔴',
      '🔴🟤  🔴        🔴  🟤🔴',
      '🔴🟤     😠😠😠     🟤🔴',
      '🔴🟤  〰️〰️〰️〰️〰️  🟤🔴',
      ' 🔴🟤🟤🟤🟤🟤🟤🟤🟤🟤🔴 ',
      '🔴🌑🔴🟤🟤🟤🟤🟤🟤🌑🔴',
      '🥛🔴🌑🌑🔴🔴🔴🔴🌑🌑🔴🥛',
      '   🔴🌑  🔴    🔴  🌑🔴   ',
      '      🦵          🦵     ',
      '      🥛          🥛     ',
    ].join('\n'),
    lore: '"My fleet carries enough milk to fill this server. None of it is for you."',
  },
  {
    name: 'RIVEN OF A THOUSAND TEATS',
    art: [
      '🟠  👁️  🟠  👁️  🟠  👁️  🟠',
      '🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠',
      '🟠  👁️  🟠  👁️  🟠  👁️  🟠',
      '🟠🌑🌑  🟠🟠🟠🟠  🌑🌑🟠',
      '🟠🌑  🟠🟠  😱  🟠🟠  🌑🟠',
      '🟠🌑  🟠🥛🥛🥛🥛🥛🟠  🌑🟠',
      '🟠🌑🌑  🟠🟠🟠🟠  🌑🌑🟠',
      '🟠  👁️  🟠🟠🟠🟠  👁️  🟠',
      '  🟠🟠🟠🌑🌑🌑🌑🟠🟠🟠  ',
      '     🟠🟠  🟠🟠  🟠🟠    ',
      '       🟠        🟠      ',
    ].join('\n'),
    lore: '"Your wish is granted. You lose all your milk bucks. I always win."',
  },
  {
    name: 'MORGETH OF SPILLED MILK',
    art: [
      '  🟣🟣🟣🟣🟣🟣🟣🟣🟣  ',
      ' 🟣🌑🌑🌑🌑🌑🌑🌑🌑🌑🟣',
      '🟣🌑  🔵        🔵  🌑🟣',
      '🟣🌑     😭😭😭     🌑🟣',
      '🟣🌑  〰️🥛〰️🥛〰️  🌑🟣',
      ' ⛓️🌑🌑🌑🌑🌑🌑🌑🌑⛓️  ',
      '🟣⛓️🟣🌑🌑🌑🌑🌑🟣⛓️🟣',
      '🥛🟣⛓️🌑🌑🌑🌑🌑⛓️🟣🥛',
      '   🟣  ⛓️  🌑  ⛓️  🟣   ',
      '        ⛓️    ⛓️         ',
      '        💧    💧         ',
    ].join('\n'),
    lore: '"Yes, it is spilled. Yes, I am crying. NO, you may not have any. It is mine."',
  },
  {
    name: 'SHURO CHI, THE WAILING WHEY',
    art: [
      '  🎵  🎶  🎵  🎶  🎵   ',
      '  🟡🟡🟡🟡🟡🟡🟡🟡🟡  ',
      ' 🟡🌑  🟡        🟡  🌑🟡',
      ' 🟡🌑     😩😩😩     🌑🟡',
      ' 🟡🌑  〰️〰️〰️〰️〰️  🌑🟡',
      '  🟡🟡🟡🟡🟡🟡🟡🟡🟡  ',
      ' 🎵🟡🟡🌑🌑🌑🌑🌑🟡🟡🎵 ',
      '🥛🎶🟡🟡🌑🌑🌑🌑🟡🟡🎶🥛',
      '    🎵  🟡🟡🟡🟡  🎵    ',
      '       🎶    🎶          ',
      '       🥛    🥛          ',
    ].join('\n'),
    lore: '"Every note I sing separates the cream. Every word you speak just makes it worse."',
  },
  {
    name: 'GAHLRAN OF THE SOURED CROWN',
    art: [
      '   👑👑👑👑👑👑👑👑👑   ',
      '  ☠️🌑🌑🌑🌑🌑🌑🌑🌑🌑☠️ ',
      ' ☠️🌑  🔴        🔴  🌑☠️',
      ' ☠️🌑     😈😈😈     🌑☠️',
      ' ☠️🌑  〰️〰️〰️〰️〰️  🌑☠️',
      '  ☠️🌑🌑🌑🌑🌑🌑🌑🌑🌑☠️  ',
      ' 👑☠️🌑🌑🌑🌑🌑🌑🌑🌑☠️👑 ',
      '🥛👑☠️🌑🌑🌑🌑🌑🌑☠️👑🥛',
      '    👑  ☠️    ☠️  👑    ',
      '         🦴    🦴       ',
      '         🥛    🥛       ',
    ].join('\n'),
    lore: '"The crown turned my milk sour. Now everything within range turns sour. You are in range."',
  },
  {
    name: 'INSURRECTION PRIME, DAIRY UNIT',
    art: [
      '⚙️⚙️💜💜💜💜💜💜💜⚙️⚙️',
      '⚙️💜🌑🌑🌑🌑🌑🌑🌑💜⚙️',
      '💜🌑  💜  👾  👾  💜  🌑💜',
      '💜🌑  💜💜💜💜💜💜💜  🌑💜',
      '💜🌑  🥛🥛🥛🥛🥛🥛🥛  🌑💜',
      '⚙️💜🌑🌑🌑🌑🌑🌑🌑💜⚙️',
      '⚙️⚙️💜💜⚙️⚙️⚙️💜💜⚙️⚙️',
      '💜⚙️💜🌑🌑🌑🌑🌑💜⚙️💜',
      '🥛💜⚙️💜💜💜💜💜⚙️💜🥛',
      '   ⚙️  ⚙️      ⚙️  ⚙️  ',
    ].join('\n'),
    lore: '"Powered by SIVA. Fueled by dairy. Piloted by someone who REALLY hates you."',
  },
  {
    name: 'THE HOMOGENIZED MIND',
    art: [
      '  🟩🟩🟩🟩🟩🟩🟩🟩🟩  ',
      ' 🟩🌑🌑🌑🌑🌑🌑🌑🌑🌑🟩',
      '🟩🌑🌑🟩🟩🟩🟩🟩🌑🌑🟩',
      '🟩🌑🟩🟩  👁️🟩👁️  🟩🟩🌑🟩',
      '🟩🌑🟩🟩🟩🟩🟩🟩🟩🟩🌑🟩',
      ' 🟩🌑🌑🌑🌑🌑🌑🌑🌑🌑🟩 ',
      '♦️🟩🟩🌑🟩🟩🟩🟩🌑🟩🟩♦️',
      '🥛♦️🟩🟩🌑🌑🌑🌑🟩🟩♦️🥛',
      '   ♦️  🟩🟩🌑🌑🟩🟩  ♦️  ',
      '       ♦️        ♦️      ',
    ].join('\n'),
    lore: '"All milk is processed here. All milk becomes the same. You will become the same."',
  },
  {
    name: 'TANIKS, THE IMMORTAL JUG',
    art: [
      '  💜💜💜💜💜💜💜💜💜  ',
      ' 💜🌑  💜💜💜💜💜  🌑💜 ',
      '💜🌑  🔴        🔴  🌑💜',
      '💜🌑     😤😤😤     🌑💜',
      '💜🌑  〰️🥛🥛🥛〰️  🌑💜',
      ' 💜🌑💜💜💜💜💜💜💜🌑💜 ',
      '💜🌑⚙️💜💜💜💜💜💜⚙️🌑💜',
      '🥛💜⚙️🌑🌑💜💜🌑🌑⚙️💜🥛',
      '   💜⚙️  🌑    🌑  ⚙️💜   ',
      '       💜  🦾  💜        ',
      '           🥛            ',
    ].join('\n'),
    lore: '"You killed me before. You will kill me again. The jug refills. I always come back."',
  },
  {
    name: 'ATRAKS-1, DEFILED DAIRY',
    art: [
      ' 🔴🔴🔴  🔴🔴🔴  🔴🔴🔴 ',
      '🔴🌑🌑🔴🔴🌑🌑🔴🔴🌑🌑🔴',
      '🔴🌑  🤖🔴🌑  🤖🔴🌑  🤖🔴',
      '🔴🌑  🔴  🔴  🔴  🔴  🌑🔴',
      '🔴🌑🔴🔴🔴🔴🔴🔴🔴🔴🌑🔴',
      '🔴  🥛  🔴🔴🔴🔴  🥛  🔴',
      ' 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴 ',
      '🥛🔴🌑🌑🔴🔴🔴🔴🌑🌑🔴🥛',
      '    🔴  🔴    🔴  🔴     ',
      '        🦾    🦾          ',
    ].join('\n'),
    lore: '"There are six of me in this room. All of them hold your milk. None will return it."',
  },
  {
    name: 'RHULK, DISCIPLE OF SPOIL',
    art: [
      '    🌑  🌑  🟥  🌑  🌑  ',
      '    🌑🟥🟥🟥🟥🟥🟥🌑   ',
      '   🌑🟥  🔴    🔴  🟥🌑  ',
      '   🌑🟥     😒😒     🟥🌑  ',
      '   🌑🟥  〰️〰️〰️〰️  🟥🌑  ',
      '    🌑🟥🟥🟥🟥🟥🟥🌑    ',
      '   🌑🟥🟥🟥🟥🟥🟥🟥🌑   ',
      '🥛 🌑🌑🟥🌑🌑🌑🟥🌑🌑 🥛',
      '       🌑  🌑  🌑       ',
      '          🪄🪄           ',
      '          🥛🥛           ',
    ].join('\n'),
    lore: '"The Witness sent me to spoil your dairy. I have exceeded expectations."',
  },
  {
    name: 'THE CARETAKER OF CREAM',
    art: [
      '    ▲▲▲▲▲▲▲▲▲▲▲▲▲    ',
      '   ▲🌑🌑🌑🌑🌑🌑🌑🌑▲   ',
      '  ▲🌑  ⬛        ⬛  🌑▲  ',
      '  ▲🌑     🥛🥛🥛     🌑▲  ',
      '  ▲🌑  〰️〰️〰️〰️〰️  🌑▲  ',
      '   ▲🌑🌑🌑🌑🌑🌑🌑🌑▲   ',
      '  ▲▲🌑🌑🌑🌑🌑🌑🌑🌑▲▲  ',
      '🥛▲▲🌑🌑▲▲▲▲🌑🌑▲▲🥛',
      '   ▲▲  ▲▲    ▲▲  ▲▲   ',
      '      ▲          ▲     ',
    ].join('\n'),
    lore: '"The last untouched milk in existence is behind me. You will not pass. I have a clipboard."',
  },
  {
    name: 'NEZAREC, FINAL MILKGOD',
    art: [
      '🌑🌑🌑🌑🌑🌑🌑🌑🌑🌑🌑',
      '🌑🟣🟣🟣🟣🟣🟣🟣🟣🟣🌑',
      '🟣🟣  🔮        🔮  🟣🟣',
      '🟣🟣     💜💜💜     🟣🟣',
      '🟣🟣  〰️🥛🥛🥛〰️  🟣🟣',
      '🌑🟣🟣🟣🟣🟣🟣🟣🟣🟣🌑',
      '🌑🌑🟣🌑🟣🟣🟣🟣🌑🟣🌑🌑',
      '🥛🌑🟣🌑🌑🟣🟣🌑🌑🟣🌑🥛',
      '   🌑🟣  💜    💜  🟣🌑   ',
      '      🌑  🌑  🌑  🌑     ',
      '         🌑    🌑        ',
    ].join('\n'),
    lore: '"Before the Collapse, there was milk. Before milk, there was me. I was hungry then too."',
  },
  {
    name: 'ZO\'AURC, SOURER OF PLANETS',
    art: [
      '   🌑  🌑  ⬛  🌑  🌑   ',
      '   🌑⬛⬛⬛⬛⬛⬛⬛🌑   ',
      '  🌑⬛  🔴        🔴  ⬛🌑  ',
      '  🌑⬛     😈😈😈     ⬛🌑  ',
      '  🌑⬛  〰️〰️〰️〰️〰️  ⬛🌑  ',
      '   🌑⬛⬛⬛⬛⬛⬛⬛🌑   ',
      '  🌑⬛⬛⬛⬛⬛⬛⬛⬛⬛🌑  ',
      '🥛🌑🌑⬛🌑🌑🌑⬛🌑🌑🥛',
      '    🌑  🗡️    🗡️  🌑   ',
      '        🌑    🌑        ',
      '        🥛    🥛        ',
    ].join('\n'),
    lore: '"Seven planets. Seven dairy industries. All soured. Yours is next."',
  },
  {
    name: 'DUL INCARU, THE ETERNAL POUR',
    art: [
      '  ❄️❄️❄️❄️❄️❄️❄️❄️❄️  ',
      ' ❄️🌑🌑🌑🌑🌑🌑🌑🌑🌑❄️',
      '❄️🌑  💙        💙  🌑❄️',
      '❄️🌑     😶😶😶     🌑❄️',
      '❄️🌑  〰️🥛🥛🥛〰️  🌑❄️',
      ' ❄️🌑🌑🌑🌑🌑🌑🌑🌑🌑❄️ ',
      '❄️❄️🌑🌑🌑🌑🌑🌑🌑🌑❄️❄️',
      '🥛❄️🌑🌑❄️❄️❄️❄️🌑🌑❄️🥛',
      '    ❄️  💧    💧  ❄️    ',
      '        ❄️    ❄️        ',
      '        🥛    🥛        ',
    ].join('\n'),
    lore: '"The vessel never empties. The pour never stops. Your floor is ruined. Eternally."',
  },
  {
    name: 'OMNIGUL, WILL OF CURD',
    art: [
      '   ☠️  ☠️  ☠️  ☠️  ☠️  ',
      '  ☠️🌑🌑🌑🌑🌑🌑🌑🌑☠️  ',
      ' ☠️🌑  😱        😱  🌑☠️ ',
      ' ☠️🌑   😱😱😱😱😱   🌑☠️ ',
      ' ☠️🌑  〰️〰️〰️〰️〰️  🌑☠️ ',
      '  ☠️🌑🌑🌑🌑🌑🌑🌑🌑☠️  ',
      ' ☠️☠️🌑🌑🌑🌑🌑🌑🌑☠️☠️ ',
      '🥛☠️🌑🌑☠️☠️☠️☠️🌑🌑☠️🥛',
      '   ☠️  〰️〰️    〰️〰️  ☠️  ',
      '      〰️          〰️     ',
    ].join('\n'),
    lore: '"SCREAMING INTENSIFIES. Your milk bucks are hers now. SCREAMING CONTINUES."',
  },
  {
    name: 'THE WITNESS OF WASTED MILK',
    art: [
      '🌑🌑🌑🌑🌑🌑🌑🌑🌑🌑🌑',
      '🌑⬛⬛⬛⬛⬛⬛⬛⬛⬛🌑',
      '⬛⬛  💜        💜  ⬛⬛',
      '⬛⬛  💜  👁️⬛👁️  💜  ⬛⬛',
      '⬛⬛     〰️⬛〰️     ⬛⬛',
      '🌑⬛⬛⬛⬛⬛⬛⬛⬛⬛🌑',
      '🌑🌑⬛⬛⬛⬛⬛⬛⬛⬛🌑🌑',
      '🥛🌑⬛⬛🌑⬛⬛⬛🌑⬛⬛🌑🥛',
      '   🌑  ⬛⬛    ⬛⬛  🌑   ',
      '      🌑          🌑    ',
      '      🥛          🥛    ',
    ].join('\n'),
    lore: '"I have witnessed every drop of wasted milk across every timeline. You are the worst offender."',
  },
  {
    name: 'THE PALE HEART OF MILK',
    art: [
      '⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛',
      '⬛🤍🤍🤍🤍🤍🤍🤍🤍🤍⬛',
      '🤍🤍  🤍        🤍  🤍🤍',
      '🤍🤍  🤍  👁️🤍👁️  🤍  🤍🤍',
      '🤍🤍     🥛🥛🥛🥛🥛     🤍🤍',
      '⬛🤍🤍🤍🤍🤍🤍🤍🤍🤍⬛',
      '⬛⬛🤍🤍🤍🤍🤍🤍🤍🤍⬛⬛',
      '🥛⬛🤍🤍⬛⬛⬛⬛🤍🤍⬛🥛',
      '   ⬛  🤍🤍    🤍🤍  ⬛   ',
      '      ⬛  🤍🤍  ⬛       ',
      '         ⬛  ⬛           ',
    ].join('\n'),
    lore: '"I am what remains when all milk is gone. Pure. Undiluted. Final. Pour nothing."',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function readData() {
  if (!fs.existsSync(DATA_PATH)) return { active: false };
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch { return { active: false }; }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function readBalances() {
  if (!fs.existsSync(BALANCES_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(BALANCES_PATH, 'utf8')); }
  catch (e) { console.error('[raidboss] corrupted balances:', e.message); return {}; }
}

function calcMaxHp() {
  const balances = readBalances();
  const activePlayers = Object.values(balances).filter(b => b > 0).length;
  return Math.max(10000, Math.min(500000, activePlayers * 2500));
}

let bossEditTimer = null;

function readXp() {
  if (!fs.existsSync(XP_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(XP_PATH, 'utf8')); }
  catch (e) { console.error('[raidboss] corrupted xp:', e.message); return {}; }
}

function buildHpBar(current, max) {
  const pct = Math.max(0, current / max);
  const filled = Math.round(pct * 20);
  const empty = 20 - filled;
  const pctStr = Math.round(pct * 100);
  return `[${'\u2588'.repeat(filled)}${'\u2591'.repeat(empty)}] ${current.toLocaleString()} / ${max.toLocaleString()}  (${pctStr}%)`;
}

function timeRemaining(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function buildAttackerLines(attacks) {
  const sorted = Object.values(attacks).sort((a, b) => b.totalDamage - a.totalDamage).slice(0, 8);
  if (sorted.length === 0) return '*(none yet — be first)*';
  const medals = ['🥇', '🥈', '🥉'];
  return sorted.map((p, i) => {
    const medal = medals[i] ?? '▸';
    return `${medal} **${p.username}** — ${p.count} hit${p.count !== 1 ? 's' : ''} · ${p.totalDamage} dmg`;
  }).join('\n');
}

function buildEmbed(bossData, { defeated = false, escaped = false } = {}) {
  const boss = BOSSES[bossData.bossIndex % BOSSES.length];
  const hpBar = buildHpBar(bossData.currentHp, bossData.maxHp);
  const attackerLines = buildAttackerLines(bossData.attacks || {});

  let title, color, footer;
  if (defeated) {
    title = `💀 ${boss.name} HAS BEEN SLAIN 💀`;
    color = 0x44ff88;
    footer = 'the dairy is safe. for now. 🥛';
  } else if (escaped) {
    title = `😈 ${boss.name} HAS ESCAPED 😈`;
    color = 0xff4444;
    footer = 'it got away. try harder tomorrow. 🥛';
  } else {
    title = `🐄 RAID BOSS HAS APPEARED 🐄`;
    color = 0xff6600;
    footer = '1 attack per 5 min · rewards scale with participation 🥛';
  }

  const desc = [
    `\`\`\``,
    boss.art,
    `\`\`\``,
    `**${boss.name}**`,
    boss.lore,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `❤️ HP  ${hpBar}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `⚔️ **ATTACKERS**`,
    attackerLines,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    defeated || escaped
      ? `⏱️ Battle ended`
      : `⏰ Expires in ${timeRemaining(bossData.expiresAt)}`,
    `⚠️ 15% chance to lose milk bucks · 1 attack per 5 min`,
    `🏆 Reward on defeat: **60 🥛 per attack** (prestige · damage scales with level)`,
  ].join('\n');

  return new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setFooter({ text: footer });
}

function buildAttackButton(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rb_attack')
      .setLabel('⚔️ Attack')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

let expiryTimeout = null;

// ── Bump (re-post boss embed to bottom of channel) ────────────────────────────

async function bumpBoss(client, channel) {
  const bossData = readData();
  if (!bossData.active || bossData.defeated) return false;

  // Delete the old message so the fresh one appears at the bottom
  if (bossData.messageId && bossData.channelId) {
    const oldChannel = channel ?? client.guilds.cache.get(GUILD_ID)?.channels.cache.get(bossData.channelId);
    if (oldChannel) {
      const old = await oldChannel.messages.fetch(bossData.messageId).catch(() => null);
      if (old) await old.delete().catch(() => {});
    }
  }

  const targetChannel = channel ?? client.guilds.cache.get(GUILD_ID)?.channels.cache.find(c => c.name === 'milkbot-games');
  if (!targetChannel) return false;

  const msg = await targetChannel.send({
    embeds: [buildEmbed(bossData)],
    components: [buildAttackButton()],
  }).catch(console.error);

  if (!msg) return false;

  bossData.messageId = msg.id;
  bossData.channelId = targetChannel.id;
  saveData(bossData);
  const boss = BOSSES[bossData.bossIndex % BOSSES.length];
  state.activeRaidBoss = { name: boss.name, currentHp: bossData.currentHp, maxHp: bossData.maxHp };
  return true;
}

// ── Spawn ──────────────────────────────────────────────────────────────────────

async function spawnBoss(client) {
  // Resolve any leftover boss first (safety guard)
  const prev = readData();
  if (prev.active && !prev.defeated) {
    await resolveRaidBoss(client, 'expired', prev).catch(console.error);
  }

  const guild = client.guilds.cache.get(GUILD_ID);
  const channel = guild?.channels.cache.find(c => c.name === 'milkbot-games');
  if (!channel) { console.log('[raidboss] milkbot-games not found'); return; }

  const prevIndex = prev.bossIndex ?? -1;
  const bossIndex = (prevIndex + 1) % BOSSES.length;
  const boss = BOSSES[bossIndex];

  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000;
  const spawnHp = calcMaxHp();

  const bossData = {
    active: true,
    bossIndex,
    spawnedAt: now,
    expiresAt,
    maxHp: spawnHp,
    currentHp: spawnHp,
    defeated: false,
    defeatedAt: null,
    messageId: null,
    channelId: channel.id,
    attacks: {},
  };

  const msg = await channel.send({
    embeds: [buildEmbed(bossData)],
    components: [buildAttackButton()],
  }).catch(console.error);

  if (!msg) { console.log('[raidboss] failed to send boss message'); return; }

  bossData.messageId = msg.id;
  saveData(bossData);
  state.activeRaidBoss = { name: boss.name, currentHp: spawnHp, maxHp: spawnHp };

  console.log(`[raidboss] spawned: ${boss.name}`);

  // Arm expiry
  if (expiryTimeout) clearTimeout(expiryTimeout);
  expiryTimeout = setTimeout(() => resolveRaidBoss(client, 'expired').catch(console.error), 24 * 60 * 60 * 1000);
}

// ── Resolve ────────────────────────────────────────────────────────────────────

async function resolveRaidBoss(client, reason, bossDataOverride = null) {
  const bossData = bossDataOverride ?? readData();
  if (!bossData.active) return; // already resolved

  bossData.active = false;
  if (reason === 'defeated') bossData.defeatedAt = Date.now();
  saveData(bossData);
  state.activeRaidBoss = null;
  if (expiryTimeout) { clearTimeout(expiryTimeout); expiryTimeout = null; }

  // Edit the boss message to show final state
  const guild = client.guilds.cache.get(GUILD_ID);
  const channel = guild?.channels.cache.get(bossData.channelId)
    ?? guild?.channels.cache.find(c => c.name === 'milkbot-games');

  if (channel && bossData.messageId) {
    const msg = await channel.messages.fetch(bossData.messageId).catch(() => null);
    if (msg) {
      await msg.edit({
        embeds: [buildEmbed(bossData, { defeated: reason === 'defeated', escaped: reason === 'expired' })],
        components: [buildAttackButton(true)],
      }).catch(console.error);
    }
  }

  // Calculate and distribute rewards
  const balances = readBalances();
  const xpData = readXp();
  const attackers = Object.entries(bossData.attacks);

  if (attackers.length === 0) {
    const noOneMsg = await channel?.send(
      reason === 'defeated'
        ? `💀 **${BOSSES[bossData.bossIndex % BOSSES.length].name}** was defeated... but nobody attacked it? How. 🥛`
        : `😈 **${BOSSES[bossData.bossIndex % BOSSES.length].name}** escaped. Nobody even tried. Shameful. 🥛`
    ).catch(console.error);
    if (noOneMsg) setTimeout(() => noOneMsg.delete().catch(() => {}), 10 * 60 * 1000);
    return;
  }

  const boss = BOSSES[bossData.bossIndex % BOSSES.length];
  const resultLines = [];
  const medals = ['🥇', '🥈', '🥉'];
  const sortedAttackers = attackers.sort(([, a], [, b]) => b.count - a.count);

  for (const [userId, record] of sortedAttackers) {
    let reward, xpGain;
    if (reason === 'defeated') {
      const pm = getMultiplier(userId);
      reward = Math.floor(record.count * 60 * pm);
      xpGain = Math.min(200, record.count * 30 + record.count * 50); // per-attack + defeat bonus
    } else {
      reward = record.count * 20;
      xpGain = Math.min(200, record.count * 30);
    }
    if (state.doubleXp) xpGain = Math.min(200, xpGain * 2);

    balances[userId] = Math.min(10_000_000, (balances[userId] || 0) + reward);
    xpData[userId] = Math.min(require('../prestige').getXpCap(userId), (xpData[userId] || 0) + xpGain);

    const i = sortedAttackers.findIndex(([id]) => id === userId);
    const medal = medals[i] ?? '▸';
    resultLines.push(`${medal} **${record.username}** — ${record.count} attack${record.count !== 1 ? 's' : ''} · **+${reward.toLocaleString()} 🥛** · +${xpGain} XP`);
  }

  fs.writeFileSync(BALANCES_PATH, JSON.stringify(balances, null, 2));
  fs.writeFileSync(XP_PATH, JSON.stringify(xpData, null, 2));

  const totalAttacks = attackers.reduce((s, [, r]) => s + r.count, 0);

  let summary;
  if (reason === 'defeated') {
    summary = [
      `🎉 **${boss.name} HAS BEEN DEFEATED!** 🎉`,
      `${totalAttacks} total attacks. The dairy is safe. Rewards below.`,
      ``,
      resultLines.join('\n'),
      ``,
      `*prestige multipliers applied · see you at midnight 🥛*`,
    ].join('\n');
  } else {
    summary = [
      `💀 **${boss.name} ESCAPED INTO THE NIGHT.** 💀`,
      `It survived with **${bossData.currentHp.toLocaleString()} HP** remaining. Consolation payout below.`,
      ``,
      resultLines.join('\n'),
      ``,
      `*come back stronger tomorrow. midnight EST. 🥛*`,
    ].join('\n');
  }

  const resMsg = await channel?.send(summary).catch(console.error);
  if (resMsg) setTimeout(() => resMsg.delete().catch(() => {}), 10 * 60 * 1000);
  console.log(`[raidboss] resolved (${reason}): ${boss.name}, ${attackers.length} attackers`);
}

// ── Handle button interaction ──────────────────────────────────────────────────

const attackingUsers = new Set();

async function handleInteraction(interaction) {
  const userId = interaction.user.id;

  if (attackingUsers.has(userId)) {
    return interaction.reply({ content: `⏳ Your attack is still processing. 🥛`, ephemeral: true });
  }
  attackingUsers.add(userId);

  await interaction.deferReply({ ephemeral: true });

  try {
    const username = interaction.user.username;

    const bossData = readData();
    if (!bossData.active || bossData.defeated) {
      return interaction.editReply({ content: `🐄 No raid boss active right now. Check back at midnight EST. 🥛` });
    }

    // Cooldown check
    const record = bossData.attacks[userId];
    if (record) {
      const elapsed = Date.now() - record.lastAttack;
      const remaining = ATTACK_COOLDOWN - elapsed;
      if (remaining > 0) {
        const mins = Math.ceil(remaining / 60000);
        return interaction.editReply({ content: `⏳ Your sword needs sharpening. Attack again in **${mins} minute${mins !== 1 ? 's' : ''}**. 🥛` });
      }
    }

    // Roll damage based on player level
    const damage = rollDamage(userId);
    bossData.currentHp = Math.max(0, bossData.currentHp - damage);

    // Roll risk
    let riskMsg = '';
    const balances = readBalances();
    if (Math.random() < RISK_CHANCE) {
      const bal = balances[userId] || 0;
      const loss = Math.max(25, Math.min(300, Math.floor(bal * 0.05)));
      balances[userId] = Math.max(0, bal - loss);
      fs.writeFileSync(BALANCES_PATH, JSON.stringify(balances, null, 2));
      riskMsg = `\n💸 The boss counter-attacked! You lost **${loss} 🥛**.`;
    }

    // Record attack
    if (!bossData.attacks[userId]) {
      bossData.attacks[userId] = { username, count: 0, lastAttack: 0, totalDamage: 0 };
    }
    bossData.attacks[userId].count++;
    bossData.attacks[userId].lastAttack = Date.now();
    bossData.attacks[userId].totalDamage += damage;
    bossData.attacks[userId].username = username; // keep display name fresh

    const defeated = bossData.currentHp <= 0;
    if (defeated) bossData.defeated = true;
    saveData(bossData);
    state.activeRaidBoss = { name: BOSSES[bossData.bossIndex % BOSSES.length].name, currentHp: bossData.currentHp, maxHp: bossData.maxHp };

    // Update boss message (debounced to avoid Discord rate limits on rapid attacks)
    const guild = interaction.guild;
    const channel = guild?.channels.cache.get(bossData.channelId)
      ?? guild?.channels.cache.find(c => c.name === 'milkbot-games');
    if (channel && bossData.messageId) {
      if (defeated) {
        // Defeat is time-sensitive — edit immediately
        const msg = await channel.messages.fetch(bossData.messageId).catch(() => null);
        if (msg) await msg.edit({ embeds: [buildEmbed(bossData, { defeated: true })], components: [buildAttackButton(true)] }).catch(console.error);
      } else {
        clearTimeout(bossEditTimer);
        bossEditTimer = setTimeout(async () => {
          const fresh = readData();
          const msg = await channel.messages.fetch(fresh.messageId ?? bossData.messageId).catch(() => null);
          if (msg) msg.edit({ embeds: [buildEmbed(fresh)], components: [buildAttackButton()] }).catch(console.error);
        }, 1500);
      }
    }

    const myRecord = bossData.attacks[userId];
    const reply = [
      `⚔️ You hit **${BOSSES[bossData.bossIndex % BOSSES.length].name}** for **${damage} damage**!`,
      `❤️ Boss HP: **${bossData.currentHp.toLocaleString()} / ${bossData.maxHp.toLocaleString()}**`,
      `📊 Your attacks this boss: **${myRecord.count}** (${myRecord.totalDamage} total dmg)`,
      riskMsg,
      defeated ? `\n💥 **YOU LANDED THE KILLING BLOW!** Rewards incoming.` : ``,
    ].filter(Boolean).join('\n');

    await interaction.editReply({ content: reply });

    if (defeated) {
      // Short delay so the embed update lands first
      setTimeout(() => resolveRaidBoss(interaction.client, 'defeated').catch(console.error), 2000);
    }
  } finally {
    attackingUsers.delete(userId);
  }
}

// ── Restore on bot restart ─────────────────────────────────────────────────────

async function restoreOnStartup(client) {
  const bossData = readData();
  if (!bossData.active || bossData.defeated) return;

  const remaining = bossData.expiresAt - Date.now();
  if (remaining <= 0) {
    await resolveRaidBoss(client, 'expired', bossData).catch(console.error);
    return;
  }

  const boss = BOSSES[bossData.bossIndex % BOSSES.length];
  state.activeRaidBoss = { name: boss.name, currentHp: bossData.currentHp, maxHp: bossData.maxHp };

  if (expiryTimeout) clearTimeout(expiryTimeout);
  expiryTimeout = setTimeout(() => resolveRaidBoss(client, 'expired').catch(console.error), remaining);

  console.log(`[raidboss] restored: ${boss.name}, ${bossData.currentHp}/${bossData.maxHp} HP, expires in ${Math.ceil(remaining / 3600000)}h`);
}

// ── Module exports ─────────────────────────────────────────────────────────────

module.exports = {
  name: 'rb',
  spawnBoss,
  bumpBoss,
  handleInteraction,
  restoreOnStartup,
};
