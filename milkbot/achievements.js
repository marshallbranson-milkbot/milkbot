const fs = require('fs');
const path = require('path');

const achPath = path.join(__dirname, 'data/achievements.json');
const balancesPath = path.join(__dirname, 'data/balances.json');
const xpPath = path.join(__dirname, 'data/xp.json');

// Sanitize usernames before they go into channel-visible embeds — a display
// name with '@everyone' or markdown would otherwise ping / break formatting.
function safeUsername(raw) {
  if (!raw) return 'Player';
  return String(raw)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[*_~`|\\]/g, '')
    .replace(/@(everyone|here)/gi, '$1')
    .replace(/<@[!&]?\d+>/g, '')
    .slice(0, 32)
    .trim() || 'Player';
}

function getData() {
  if (!fs.existsSync(achPath)) return {};
  try { return JSON.parse(fs.readFileSync(achPath, 'utf8')); }
  catch (e) { console.error('[achievements] corrupted:', achPath); return {}; }
}

function saveData(data) {
  fs.writeFileSync(achPath, JSON.stringify(data, null, 2));
}

function getLevel(totalXp) {
  let level = 1, xpUsed = 0;
  while (true) {
    const needed = level * 100;
    if (xpUsed + needed > totalXp) break;
    xpUsed += needed;
    level++;
  }
  return level;
}

function getRank(level) {
  if (level >= 50) return 'THE ONE TRUE MOO';
  if (level >= 45) return 'Milk Eternal';
  if (level >= 40) return 'Milk God';
  if (level >= 35) return 'Milk Overlord';
  if (level >= 30) return 'Milk Legend';
  if (level >= 25) return 'Milk Baron';
  if (level >= 20) return 'Milk Dealer';
  if (level >= 15) return 'Milk Hustler';
  if (level >= 10) return 'Milk Fiend';
  if (level >= 5)  return 'Milk Drinker';
  return 'Milk Baby';
}

function xpToNextLevel(totalXp) {
  let xpUsed = 0, level = 1;
  while (true) {
    const needed = level * 100;
    if (xpUsed + needed > totalXp) return (xpUsed + needed) - totalXp;
    xpUsed += needed;
    level++;
  }
}

const LEVEL_QUIPS = [
  'Not bad for a dairy enjoyer.',
  'The grind is real and so are you.',
  'MilkBot is proud. Don\'t make it weird.',
  'Keep it up and you might actually be someone.',
  'The milk is strong with this one.',
];

const RANK_DMS = {
  'Milk Drinker': (u, lvl, n) => `🥛 **NEW RANK: MILK DRINKER** 🥛\n\nLook at you, ${u}. You graduated from baby formula. Welcome to the real stuff.\n\n**Level ${lvl}** — *${n} XP to Level ${lvl + 1}*`,
  'Milk Fiend':   (u, lvl, n) => `🥛 **NEW RANK: MILK FIEND** 🥛\n\nYou can't stop. Won't stop. The milk has completely taken over, ${u}.\n\n**Level ${lvl}** — *${n} XP to Level ${lvl + 1}*`,
  'Milk Hustler': (u, lvl, n) => `🥛 **NEW RANK: MILK HUSTLER** 🥛\n\nGrinding like the dairy never closes. This is your life now, ${u}.\n\n**Level ${lvl}** — *${n} XP to Level ${lvl + 1}*`,
  'Milk Legend':  (u, lvl, n) => `⭐ **NEW RANK: MILK LEGEND** ⭐\n\nPeople whisper your name in milkbot channels, ${u}. This is real.\n\n**Level ${lvl}** — *${n} XP to Level ${lvl + 1}*`,
  'Milk God':     (u, lvl, n) => `🌟 **NEW RANK: MILK GOD** 🌟\n\nYou have ascended, ${u}. The cows kneel. There is only milk.\n\n**Level ${lvl}** — *${n} XP to Level ${lvl + 1}*`,
};

const RANK_ANNOUNCEMENTS = {
  'Milk Drinker': (u, lvl) => `🥛 **${u}** just became a **Milk Drinker**! (Level ${lvl}) No more baby formula for them. 🍼`,
  'Milk Fiend':   (u, lvl) => `🔥 **${u}** is now a **Milk Fiend**! (Level ${lvl}) Someone stop them before they break the bot. 🥛`,
  'Milk Hustler': (u, lvl) => `💪 **${u}** just ranked up to **Milk Hustler**! (Level ${lvl}) Respect the grind. 🥛`,
  'Milk Legend':  (u, lvl) => `⭐ **LEGEND STATUS** — **${u}** is now a **Milk Legend**! (Level ${lvl}) 🥛`,
  'Milk God':     (u, lvl) => `🌟 **THE MILK GODS HAVE SPOKEN** 🌟\n**${u}** has ascended to **MILK GOD** at Level ${lvl}. We are not worthy. 🥛`,
};

function buildLevelDm(username, level, toNext) {
  const quip = LEVEL_QUIPS[level % LEVEL_QUIPS.length];
  return `🥛 **Level Up!**\n\nYou just hit **Level ${level}**, ${username}! ${quip}\n\n*${toNext} XP until Level ${level + 1}*`;
}

const ACHIEVEMENTS = [
  // ── WINS & STREAKS ─────────────────────────────────────────────────────────
  { id: 'first_sip',        emoji: '🎯', name: 'First Sip',           xp: 25,  desc: 'Win your first game'                                        },
  { id: 'hot_streak',       emoji: '🔥', name: 'Hot Streak',           xp: 50,  desc: 'Get 3 wins in a row'                                        },
  { id: 'inferno',          emoji: '🌋', name: 'Inferno',              xp: 100, desc: 'Get 5 wins in a row'                                        },
  { id: 'lucky_seven',      emoji: '🍀', name: 'Lucky Seven',          xp: 150, desc: 'Get 7 wins in a row'                                        },
  { id: 'unbreakable',      emoji: '🛡️',  name: 'Unbreakable',          xp: 200, desc: 'Get 10 wins in a row'                                       },
  { id: 'milkbot_approved', emoji: '✅', name: 'MilkBot Approved',     xp: 150, desc: 'Win at 5 different game types'                              },
  // ── SLOTS ──────────────────────────────────────────────────────────────────
  { id: 'jackpot',          emoji: '👑', name: 'Jackpot',              xp: 150, desc: 'Hit triple crowns in slots'                                 },
  // ── BLACKJACK ──────────────────────────────────────────────────────────────
  { id: 'natural',          emoji: '🃏', name: 'Natural',              xp: 75,  desc: 'Hit blackjack on the first deal'                            },
  { id: 'card_shark',       emoji: '🦈', name: 'Card Shark',           xp: 100, desc: 'Win 10 blackjack games'                                     },
  { id: 'high_roller',      emoji: '💸', name: 'High Roller',          xp: 75,  desc: 'Bet 500+ in a single blackjack hand'                        },
  { id: 'ruined',           emoji: '😵', name: 'Ruined',               xp: 200, desc: 'Bust in blackjack with a 1,000+ bet'                        },
  // ── SCRAMBLE ───────────────────────────────────────────────────────────────
  { id: 'rare_word',        emoji: '💎', name: 'Wordsmith',            xp: 50,  desc: 'Unscramble a rare word'                                     },
  { id: 'speed_demon',      emoji: '⚡', name: 'Speed Demon',          xp: 100, desc: 'Solve a scramble in under 5 seconds'                        },
  { id: 'sniper',           emoji: '🎯', name: 'Sniper',               xp: 150, desc: 'Solve a scramble in under 3 seconds'                        },
  // ── GEO ────────────────────────────────────────────────────────────────────
  { id: 'globetrotter',     emoji: '🌍', name: 'Globetrotter',         xp: 100, desc: 'Win 10 geo flag games'                                      },
  // ── TRIVIA ─────────────────────────────────────────────────────────────────
  { id: 'trivia_master',    emoji: '🧠', name: 'Trivia Master',        xp: 100, desc: 'Win 10 trivia games'                                        },
  // ── COINFLIP ───────────────────────────────────────────────────────────────
  { id: 'heads_or_tails',   emoji: '🪙', name: 'Heads or Tails',       xp: 75,  desc: 'Win 5 coinflips in a row'                                   },
  // ── LOSSES ─────────────────────────────────────────────────────────────────
  { id: 'tilt',             emoji: '😤', name: 'Tilt',                 xp: 25,  desc: 'Lose 3 games in a row'                                      },
  // ── ROB ────────────────────────────────────────────────────────────────────
  { id: 'stick_up',         emoji: '🔫', name: 'Stick Up',             xp: 50,  desc: 'Successfully rob someone'                                   },
  { id: 'serial_robber',    emoji: '🕵️',  name: 'Serial Robber',        xp: 100, desc: 'Successfully rob 5 times'                                   },
  { id: 'clowned',          emoji: '🤡', name: 'Clowned',              xp: 25,  desc: 'Get successfully robbed'                                    },
  // ── RAID ───────────────────────────────────────────────────────────────────
  { id: 'raider',           emoji: '⚔️',  name: 'Raider',               xp: 50,  desc: 'Win a raid'                                                 },
  { id: 'bounty_hunter',    emoji: '💰', name: 'Bounty Hunter',        xp: 100, desc: 'Win 3 raids'                                                },
  { id: 'crew_leader',      emoji: '📣', name: 'Crew Leader',          xp: 75,  desc: 'Win a raid with a crew of 4+'                               },
  // ── CRATE ──────────────────────────────────────────────────────────────────
  { id: 'finders_keepers',  emoji: '📦', name: 'Finders Keepers',      xp: 25,  desc: 'Claim a crate drop'                                         },
  // ── DAILY ──────────────────────────────────────────────────────────────────
  { id: 'consistent',       emoji: '📅', name: 'Consistent',           xp: 75,  desc: 'Reach a 7-day daily streak'                                 },
  { id: 'dedicated',        emoji: '🗓️',  name: 'Dedicated',            xp: 200, desc: 'Reach a 30-day daily streak'                                },
  // ── STOCKS ─────────────────────────────────────────────────────────────────
  { id: 'day_trader',       emoji: '📊', name: 'Day Trader',           xp: 25,  desc: 'Make your first stock trade'                                },
  { id: 'diversified',      emoji: '💼', name: 'Diversified',          xp: 75,  desc: 'Own 3+ different stocks at once'                            },
  { id: 'full_portfolio',   emoji: '🗂️',  name: 'Full Portfolio',       xp: 150, desc: 'Own all 8 stocks at once'                                   },
  { id: 'bull_run',         emoji: '📈', name: 'Bull Run',             xp: 100, desc: 'Sell a stock for 50%+ profit'                               },
  { id: 'bag_holder',       emoji: '📉', name: 'Bag Holder',           xp: 25,  desc: 'Sell a stock at a loss'                                     },
  { id: 'diamond_hands',    emoji: '💎', name: 'Diamond Hands',        xp: 100, desc: 'Hold a stock for 24+ hours before selling'                  },
  // ── BALANCE MILESTONES ─────────────────────────────────────────────────────
  { id: 'milk_money',       emoji: '💰', name: 'Milk Money',           xp: 25,  desc: 'Hold 1,000 milk bucks at once'                              },
  { id: 'dairy_rich',       emoji: '🤑', name: 'Dairy Rich',           xp: 75,  desc: 'Hold 5,000 milk bucks at once'                              },
  { id: 'whale',            emoji: '🐳', name: 'Whale',                xp: 150, desc: 'Hold 10,000 milk bucks at once'                             },
  { id: 'to_the_moon',      emoji: '🚀', name: 'To the Moon',          xp: 250, desc: 'Hold 25,000 milk bucks at once'                             },
  { id: 'broke',            emoji: '😭', name: 'Flat Broke',           xp: 10,  desc: 'Hit 0 milk bucks'                                           },
  // ── XP & LEVELS ────────────────────────────────────────────────────────────
  { id: 'grinder',          emoji: '⚙️',  name: 'Grinder',              xp: 150, desc: 'Earn 1,000 total XP'                                        },
  { id: 'milk_fiend',       emoji: '⭐', name: 'Milk Fiend',           xp: 100, desc: 'Reach Level 10'                                             },
  { id: 'milk_god',         emoji: '🌟', name: 'Milk God',             xp: 300, desc: 'Reach Level 25'                                             },
  // ── DUNGEON ────────────────────────────────────────────────────────────────
  { id: 'first_descent',    emoji: '🏰', name: 'First Descent',        xp: 50,  desc: 'Complete your first dungeon run (win or lose)'              },
  { id: 'floor_5',          emoji: '🗝️',  name: 'Halfway Cursed',       xp: 100, desc: 'Reach floor 5 in the dungeon'                               },
  { id: 'floor_10',         emoji: '🏆', name: 'Vault Breaker',        xp: 200, desc: 'Reach the Curdfather'                                       },
  { id: 'curdfather_down',  emoji: '🧀', name: "Curdfather Slain",     xp: 500, desc: 'Defeat the Curdfather'                                      },
  { id: 'solo_runner',      emoji: '🚶', name: 'Solo Runner',          xp: 300, desc: 'Complete a dungeon run solo'                                },
  { id: 'no_revives',       emoji: '💪', name: 'No Retreat',           xp: 250, desc: 'Complete a dungeon run without using Revive'                },
];

// events: game_win | trivia_win | slots_jackpot | blackjack_natural | rob_success |
//         raid_win | raid_start | crate_claim | daily_streak | trade_made | rare_word |
//         portfolio | sell_result | slot_spin | bj_win | bj_bust | bj_timeout |
//         game_loss | coinflip_win | coinflip_loss | rob_victim | scramble_win
function check(userId, username, event, data, channel) {
  // Hook into daily/weekly quest progress tracking. Safe to call — quest module handles unknown events.
  try { require('./dailyquests').recordEvent(userId, username, event, data, channel); } catch (e) { console.warn('[quests] hook failed:', e.message); }

  const allData = getData();
  const user = allData[userId] || { unlocked: [], counters: {} };
  if (!user.counters) user.counters = {};
  const unlocked = new Set(user.unlocked);
  const newlyUnlocked = [];
  const c = user.counters;

  function unlock(id) {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      newlyUnlocked.push(id);
    }
  }

  // ── WIN EVENTS (reset loss streak, track game types) ─────────────────────
  const isWinEvent = ['game_win','trivia_win','bj_win','slots_jackpot','blackjack_natural',
                      'coinflip_win','raid_win','scramble_win','rare_word','crate_claim'].includes(event);

  if (isWinEvent) {
    unlock('first_sip');
    c.loss_streak = 0;

    // Track unique game types for milkbot_approved
    if (!c.game_types_won) c.game_types_won = [];
    const gt = data.gameType;
    if (gt && !c.game_types_won.includes(gt)) {
      c.game_types_won.push(gt);
    }
    if (c.game_types_won.length >= 5) unlock('milkbot_approved');
  }

  if (event === 'slots_jackpot') {
    unlock('jackpot');
  }

  // ── BLACKJACK ─────────────────────────────────────────────────────────────
  if (event === 'blackjack_natural') {
    unlock('natural');
  }

  if (event === 'bj_win') {
    c.bj_wins = (c.bj_wins || 0) + 1;
    if (c.bj_wins >= 10) unlock('card_shark');
    if ((data.bet || 0) >= 500) unlock('high_roller');
  }

  if (event === 'bj_bust') {
    c.loss_streak = (c.loss_streak || 0) + 1;
    if ((data.bet || 0) >= 1000) unlock('ruined');
    if ((data.bet || 0) >= 500) unlock('high_roller');
    if (c.loss_streak >= 3) unlock('tilt');
  }

  if (event === 'bj_timeout') {
    c.loss_streak = (c.loss_streak || 0) + 1;
  }

  // ── SCRAMBLE ──────────────────────────────────────────────────────────────
  if (event === 'rare_word') {
    unlock('rare_word');
  }

  if (event === 'scramble_win') {
    if (data.isRare) unlock('rare_word');
    if ((data.responseMs || 9999) < 5000) unlock('speed_demon');
    if ((data.responseMs || 9999) < 3000) unlock('sniper');
  }

  // ── GEO ───────────────────────────────────────────────────────────────────
  if (event === 'game_win' && data.gameType === 'geo') {
    c.geo_wins = (c.geo_wins || 0) + 1;
    if (c.geo_wins >= 10) unlock('globetrotter');
  }

  // ── TRIVIA ────────────────────────────────────────────────────────────────
  if (event === 'trivia_win') {
    c.trivia_wins = (c.trivia_wins || 0) + 1;
    if (c.trivia_wins >= 10) unlock('trivia_master');
  }

  // ── COINFLIP ──────────────────────────────────────────────────────────────
  if (event === 'coinflip_win') {
    c.cf_streak = (c.cf_streak || 0) + 1;
    if (c.cf_streak >= 5) unlock('heads_or_tails');
  }

  if (event === 'coinflip_loss') {
    c.cf_streak = 0;
    c.loss_streak = (c.loss_streak || 0) + 1;
    if (c.loss_streak >= 3) unlock('tilt');
  }

  // ── FLIPHOUSE / GAME LOSS ─────────────────────────────────────────────────
  if (event === 'game_loss') {
    c.loss_streak = (c.loss_streak || 0) + 1;
    if (c.loss_streak >= 3) unlock('tilt');
    if (data.gameType === 'geo') c.geo_streak = 0;
  }

  // ── ROB ───────────────────────────────────────────────────────────────────
  if (event === 'rob_success') {
    unlock('stick_up');
    c.rob_successes = (c.rob_successes || 0) + 1;
    if (c.rob_successes >= 5) unlock('serial_robber');
  }

  if (event === 'rob_victim') {
    unlock('clowned');
  }

  // ── RAID ──────────────────────────────────────────────────────────────────
  if (event === 'raid_win') {
    unlock('raider');
    c.raid_wins = (c.raid_wins || 0) + 1;
    if (c.raid_wins >= 3) unlock('bounty_hunter');
    if ((data.crewSize || 0) >= 4) unlock('crew_leader');
  }

  if (event === 'raid_start') {
    // fired only for leader when raid resolves
    if ((data.crewSize || 0) >= 4) unlock('crew_leader');
  }

  // ── CRATE ─────────────────────────────────────────────────────────────────
  if (event === 'crate_claim') {
    unlock('finders_keepers');
  }

  // ── DAILY ─────────────────────────────────────────────────────────────────
  if (event === 'daily_streak') {
    if (data.dailyStreak >= 7)  unlock('consistent');
    if (data.dailyStreak >= 30) unlock('dedicated');
  }

  // ── STOCK TRADE ───────────────────────────────────────────────────────────
  if (event === 'trade_made') {
    unlock('day_trader');
  }

  if (event === 'portfolio') {
    if (data.portfolioSize >= 3) unlock('diversified');
    if (data.portfolioSize >= 8) unlock('full_portfolio');
  }

  if (event === 'sell_result') {
    if ((data.profit || 0) < 0) unlock('bag_holder');
    if ((data.profitRatio || 0) >= 0.5) unlock('bull_run');
    if ((data.heldHours || 0) >= 24)    unlock('diamond_hands');
  }

  // ── STREAK-BASED (provided by win streak system) ──────────────────────────
  if (data.streak !== undefined) {
    if (data.streak >= 3)  unlock('hot_streak');
    if (data.streak >= 5)  unlock('inferno');
    if (data.streak >= 7)  unlock('lucky_seven');
    if (data.streak >= 10) unlock('unbreakable');
  }

  // ── BALANCE MILESTONES ────────────────────────────────────────────────────
  if (data.balance !== undefined) {
    if (data.balance <= 0)      unlock('broke');
    if (data.balance >= 1000)   unlock('milk_money');
    if (data.balance >= 5000)   unlock('dairy_rich');
    if (data.balance >= 10000)  unlock('whale');
    if (data.balance >= 25000)  unlock('to_the_moon');

  }

  // ── DUNGEON ──────────────────────────────────────────────────────────────
  if (event === 'dungeon_run_end') {
    unlock('first_descent');
    if ((data.deepestFloor || 0) >= 5) unlock('floor_5');
    if ((data.deepestFloor || 0) >= 10) unlock('floor_10');
    if (data.completed) {
      if ((data.partySize || 0) === 1) unlock('solo_runner');
      if (data.noRevives) unlock('no_revives');
    }
  }
  if (event === 'dungeon_curdfather_kill') {
    unlock('curdfather_down');
  }

  // ── XP & LEVEL MILESTONES ─────────────────────────────────────────────────
  if (data.xp !== undefined) {
    const level = getLevel(data.xp);
    if (level >= 10)     unlock('milk_fiend');
    if (level >= 80)     unlock('milk_god');
    if (data.xp >= 1000) unlock('grinder');
  }

  // ── ANNOUNCE ACHIEVEMENTS + AWARD BONUS XP ───────────────────────────────
  let bonusXp = 0;
  for (const id of newlyUnlocked) {
    const a = ACHIEVEMENTS.find(a => a.id === id);
    if (!a) continue;
    bonusXp += a.xp;
    channel.send(
      `🏆 **ACHIEVEMENT UNLOCKED** — **${safeUsername(username)}**\n` +
      `${a.emoji} **${a.name}** — ${a.desc}` +
      (a.xp > 0 ? ` *(+${a.xp} XP)* 🥛` : ` 🥛`)
    ).catch(() => {});
  }
  if (bonusXp > 0) {
    try {
      const xpData = fs.existsSync(xpPath) ? JSON.parse(fs.readFileSync(xpPath, 'utf8')) : {};
      xpData[userId] = (xpData[userId] || 0) + bonusXp;
      fs.writeFileSync(xpPath, JSON.stringify(xpData, null, 2));
    } catch (e) { console.error('[achievements] XP save failed:', e.message); }
  }

  // ── LEVEL-UP CHECK ────────────────────────────────────────────────────────
  try {
    const xpData = fs.existsSync(xpPath) ? JSON.parse(fs.readFileSync(xpPath, 'utf8')) : {};
    const finalXp = xpData[userId] || 0;
    const newLevel = getLevel(finalXp);
    const storedLevel = user.level;

    if (storedLevel === undefined) {
      user.level = newLevel; // first time — set baseline silently
    } else if (newLevel > storedLevel) {
      const oldRank = getRank(storedLevel);
      const newRank = getRank(newLevel);
      const rankChanged = newRank !== oldRank;
      user.level = newLevel;
      const toNext = xpToNextLevel(finalXp);

      // DM the player
      channel.client.users.fetch(userId).then(u => {
        const dm = rankChanged
          ? (RANK_DMS[newRank]?.(username, newLevel, toNext) ?? buildLevelDm(username, newLevel, toNext))
          : buildLevelDm(username, newLevel, toNext);
        u.send(dm).catch(() => {});
      }).catch(() => {});

      // Channel shoutout on new rank
      if (rankChanged) {
        const fn = RANK_ANNOUNCEMENTS[newRank];
        if (fn) channel.send(fn(username, newLevel));
      }
    }
  } catch (_) {}

  // ── SAVE ──────────────────────────────────────────────────────────────────
  user.unlocked = [...unlocked];
  user.counters = c;
  allData[userId] = user;
  saveData(allData);
}

module.exports = { ACHIEVEMENTS, check };
