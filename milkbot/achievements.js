const fs = require('fs');
const path = require('path');

const achPath = path.join(__dirname, 'data/achievements.json');

function getData() {
  if (!fs.existsSync(achPath)) return {};
  return JSON.parse(fs.readFileSync(achPath, 'utf8'));
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

const ACHIEVEMENTS = [
  { id: 'first_sip',       emoji: '🎯', name: 'First Sip',       desc: 'Win your first game'                        },
  { id: 'hot_streak',      emoji: '🔥', name: 'Hot Streak',       desc: 'Get 3 wins in a row'                        },
  { id: 'inferno',         emoji: '🌋', name: 'Inferno',           desc: 'Get 5 wins in a row'                        },
  { id: 'jackpot',         emoji: '👑', name: 'Jackpot',           desc: 'Hit triple crowns in slots'                 },
  { id: 'natural',         emoji: '🃏', name: 'Natural',           desc: 'Get a blackjack on the first deal'          },
  { id: 'rare_word',       emoji: '💎', name: 'Wordsmith',         desc: 'Unscramble a rare word'                     },
  { id: 'milk_money',      emoji: '💰', name: 'Milk Money',        desc: 'Hold 1,000 milk bucks at once'              },
  { id: 'dairy_rich',      emoji: '🤑', name: 'Dairy Rich',        desc: 'Hold 5,000 milk bucks at once'              },
  { id: 'whale',           emoji: '🐳', name: 'Whale',             desc: 'Hold 10,000 milk bucks at once'             },
  { id: 'broke',           emoji: '😭', name: 'Flat Broke',        desc: 'Hit 0 milk bucks'                           },
  { id: 'stick_up',        emoji: '🔫', name: 'Stick Up',          desc: 'Successfully rob someone'                   },
  { id: 'raider',          emoji: '⚔️',  name: 'Raider',            desc: 'Win a raid'                                 },
  { id: 'finders_keepers', emoji: '📦', name: 'Finders Keepers',   desc: 'Claim a crate drop'                         },
  { id: 'consistent',      emoji: '📅', name: 'Consistent',        desc: 'Reach a 7-day daily streak'                 },
  { id: 'dedicated',       emoji: '🗓️',  name: 'Dedicated',         desc: 'Reach a 30-day daily streak'                },
  { id: 'day_trader',      emoji: '📊', name: 'Day Trader',        desc: 'Make your first stock trade'                },
  { id: 'diversified',     emoji: '💼', name: 'Diversified',       desc: 'Own 3 or more different stocks at once'     },
  { id: 'trivia_master',   emoji: '🧠', name: 'Trivia Master',     desc: 'Win 10 trivia games'                        },
  { id: 'milk_fiend',      emoji: '⭐', name: 'Milk Fiend',        desc: 'Reach Level 10'                             },
  { id: 'milk_god',        emoji: '🌟', name: 'Milk God',          desc: 'Reach Level 25'                             },
];

// event: 'game_win' | 'trivia_win' | 'slots_jackpot' | 'blackjack_natural' | 'rob_success' |
//        'raid_win' | 'crate_claim' | 'daily_streak' | 'trade_made' | 'rare_word'
// data: { balance?, xp?, streak?, portfolioSize?, dailyStreak? }
function check(userId, username, event, data, channel) {
  const allData = getData();
  const user = allData[userId] || { unlocked: [], trivia_wins: 0 };
  const unlocked = new Set(user.unlocked);
  const newlyUnlocked = [];

  function unlock(id) {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      newlyUnlocked.push(id);
    }
  }

  // Event-specific unlocks
  if (event === 'game_win' || event === 'trivia_win') {
    unlock('first_sip');
  }

  if (event === 'trivia_win') {
    user.trivia_wins = (user.trivia_wins || 0) + 1;
    if (user.trivia_wins >= 10) unlock('trivia_master');
  }

  if (event === 'slots_jackpot') unlock('jackpot');
  if (event === 'blackjack_natural') unlock('natural');
  if (event === 'rob_success') unlock('stick_up');
  if (event === 'raid_win') unlock('raider');
  if (event === 'crate_claim') unlock('finders_keepers');
  if (event === 'rare_word') unlock('rare_word');
  if (event === 'trade_made') unlock('day_trader');
  if (event === 'portfolio' && data.portfolioSize >= 3) unlock('diversified');

  if (event === 'daily_streak') {
    if (data.dailyStreak >= 7)  unlock('consistent');
    if (data.dailyStreak >= 30) unlock('dedicated');
  }

  if (data.streak !== undefined) {
    if (data.streak >= 3) unlock('hot_streak');
    if (data.streak >= 5) unlock('inferno');
  }

  // Balance milestones — checked on any event that provides balance
  if (data.balance !== undefined) {
    if (data.balance <= 0)      unlock('broke');
    if (data.balance >= 1000)   unlock('milk_money');
    if (data.balance >= 5000)   unlock('dairy_rich');
    if (data.balance >= 10000)  unlock('whale');
  }

  // Level milestones — checked on any event that provides xp
  if (data.xp !== undefined) {
    const level = getLevel(data.xp);
    if (level >= 10) unlock('milk_fiend');
    if (level >= 25) unlock('milk_god');
  }

  // Save updated user data
  user.unlocked = [...unlocked];
  allData[userId] = user;
  saveData(allData);

  // Announce newly unlocked
  for (const id of newlyUnlocked) {
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) continue;
    channel.send(
      `🏆 **ACHIEVEMENT UNLOCKED** — **${username}**\n` +
      `${ach.emoji} **${ach.name}** — ${ach.desc} 🥛`
    );
  }
}

module.exports = { ACHIEVEMENTS, check };
