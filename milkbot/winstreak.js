const fs = require('fs');
const path = require('path');

const streaksPath = path.join(__dirname, 'data/streaks.json');

function getData() {
  if (!fs.existsSync(streaksPath)) return {};
  return JSON.parse(fs.readFileSync(streaksPath, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(streaksPath, JSON.stringify(data, null, 2));
}

// Returns new streak count after recording a win
function recordWin(userId) {
  const data = getData();
  data[userId] = (data[userId] || 0) + 1;
  saveData(data);
  return data[userId];
}

// Returns previous streak count before resetting
function resetStreak(userId) {
  const data = getData();
  const prev = data[userId] || 0;
  if (prev > 0) {
    data[userId] = 0;
    saveData(data);
  }
  return prev;
}

function getStreak(userId) {
  return getData()[userId] || 0;
}

function announceStreak(channel, username, newStreak) {
  if (newStreak === 3) {
    channel.send(`🔥 **${username} is on a HOT STREAK!** 3 wins in a row — 1.5x on everything! 🥛`);
  } else if (newStreak > 3) {
    channel.send(`🔥 **${username}** is cooking — **${newStreak} wins** in a row! 🥛`);
  }
}

module.exports = { recordWin, resetStreak, getStreak, announceStreak };
