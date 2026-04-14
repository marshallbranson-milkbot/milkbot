const fs = require('fs');
const path = require('path');

const prestigePath   = path.join(__dirname, 'data/prestige.json');
const xpPath         = path.join(__dirname, 'data/xp.json');
const achPath        = path.join(__dirname, 'data/achievements.json');
const balancesPath   = path.join(__dirname, 'data/balances.json');
const portfoliosPath = path.join(__dirname, 'data/portfolios.json');

function getPrestige(userId) {
  if (!fs.existsSync(prestigePath)) return 0;
  return JSON.parse(fs.readFileSync(prestigePath, 'utf8'))[userId] || 0;
}

// prestige 0 → 1x, prestige 1 → 2x, prestige 2 → 3x, etc.
function getMultiplier(userId) {
  return getPrestige(userId) + 1;
}

// Resets XP, increments prestige, resets stored level so DMs fire again.
// Returns the new prestige level.
function doPrestige(userId) {
  const pData = fs.existsSync(prestigePath)
    ? JSON.parse(fs.readFileSync(prestigePath, 'utf8'))
    : {};
  pData[userId] = (pData[userId] || 0) + 1;
  fs.writeFileSync(prestigePath, JSON.stringify(pData, null, 2));

  // Reset XP
  const xpData = fs.existsSync(xpPath)
    ? JSON.parse(fs.readFileSync(xpPath, 'utf8'))
    : {};
  xpData[userId] = 0;
  fs.writeFileSync(xpPath, JSON.stringify(xpData, null, 2));

  // Reset milk bucks balance
  const balances = fs.existsSync(balancesPath)
    ? JSON.parse(fs.readFileSync(balancesPath, 'utf8'))
    : {};
  balances[userId] = 0;
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));

  // Reset stock portfolio
  if (fs.existsSync(portfoliosPath)) {
    const portfolios = JSON.parse(fs.readFileSync(portfoliosPath, 'utf8'));
    delete portfolios[userId];
    fs.writeFileSync(portfoliosPath, JSON.stringify(portfolios, null, 2));
  }

  // Reset stored level in achievements so level-up DMs fire again from level 1
  if (fs.existsSync(achPath)) {
    const achData = JSON.parse(fs.readFileSync(achPath, 'utf8'));
    if (achData[userId]) {
      achData[userId].level = 1;
      fs.writeFileSync(achPath, JSON.stringify(achData, null, 2));
    }
  }

  return pData[userId];
}

module.exports = { getPrestige, getMultiplier, doPrestige };
