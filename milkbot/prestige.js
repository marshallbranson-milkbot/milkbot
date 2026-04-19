const fs = require('fs');
const path = require('path');

const prestigePath   = path.join(__dirname, 'data/prestige.json');
const xpPath         = path.join(__dirname, 'data/xp.json');
const achPath        = path.join(__dirname, 'data/achievements.json');
const balancesPath   = path.join(__dirname, 'data/balances.json');
const portfoliosPath = path.join(__dirname, 'data/portfolios.json');

function getPrestige(userId) {
  if (!fs.existsSync(prestigePath)) return 0;
  try { return JSON.parse(fs.readFileSync(prestigePath, 'utf8'))[userId] || 0; }
  catch (e) { console.error('[prestige] corrupted:', prestigePath); return 0; }
}

// prestige 0 → 1x, prestige 1 → 2x, prestige 2 → 3x, etc.
function getMultiplier(userId) {
  return getPrestige(userId) + 1;
}

// Resets XP, increments prestige, resets stored level so DMs fire again.
// Returns the new prestige level, or current level if already at cap.
function doPrestige(userId) {
  let pData = {};
  if (fs.existsSync(prestigePath)) {
    try { pData = JSON.parse(fs.readFileSync(prestigePath, 'utf8')); }
    catch (e) { console.error('[prestige] corrupted:', prestigePath); }
  }
  if ((pData[userId] || 0) >= 5) return pData[userId];
  pData[userId] = (pData[userId] || 0) + 1;
  fs.writeFileSync(prestigePath, JSON.stringify(pData, null, 2));

  // Reset XP
  let xpData = {};
  if (fs.existsSync(xpPath)) {
    try { xpData = JSON.parse(fs.readFileSync(xpPath, 'utf8')); }
    catch (e) { console.error('[prestige] corrupted xp:', xpPath); }
  }
  xpData[userId] = 0;
  fs.writeFileSync(xpPath, JSON.stringify(xpData, null, 2));

  // Reset milk bucks balance
  let balances = {};
  if (fs.existsSync(balancesPath)) {
    try { balances = JSON.parse(fs.readFileSync(balancesPath, 'utf8')); }
    catch (e) { console.error('[prestige] corrupted balances:', balancesPath); }
  }
  balances[userId] = 0;
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));

  // Reset stock portfolio
  if (fs.existsSync(portfoliosPath)) {
    let portfolios = {};
    try { portfolios = JSON.parse(fs.readFileSync(portfoliosPath, 'utf8')); }
    catch (e) { console.error('[prestige] corrupted portfolios:', portfoliosPath); }
    delete portfolios[userId];
    fs.writeFileSync(portfoliosPath, JSON.stringify(portfolios, null, 2));
  }

  // Reset stored level in achievements so level-up DMs fire again from level 1
  if (fs.existsSync(achPath)) {
    let achData = {};
    try { achData = JSON.parse(fs.readFileSync(achPath, 'utf8')); }
    catch (e) { console.error('[prestige] corrupted ach:', achPath); }
    if (achData[userId]) {
      achData[userId].level = 1;
      fs.writeFileSync(achPath, JSON.stringify(achData, null, 2));
    }
  }

  return pData[userId];
}

// prestige 0–4: cap at level 50 (XP sum 1–49 = 122,500). prestige 5: unlimited.
function getXpCap(userId) {
  return getPrestige(userId) >= 5 ? Infinity : 122500;
}

function getLevelCap(userId) {
  return getPrestige(userId) >= 5 ? Infinity : 50;
}

module.exports = { getPrestige, getMultiplier, doPrestige, getXpCap, getLevelCap };
