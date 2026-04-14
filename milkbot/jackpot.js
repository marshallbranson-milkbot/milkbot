const fs = require('fs');
const path = require('path');

const jackpotPath = path.join(__dirname, 'data/jackpot.json');
const balancesPath = path.join(__dirname, 'data/balances.json');

function getJackpot() {
  if (!fs.existsSync(jackpotPath)) return 0;
  return JSON.parse(fs.readFileSync(jackpotPath, 'utf8')).amount || 0;
}

function addToJackpot(amount = 5) {
  const current = getJackpot();
  fs.writeFileSync(jackpotPath, JSON.stringify({ amount: current + amount }, null, 2));
}

// Returns true if jackpot was triggered. Call on every game WIN.
function tryJackpot(userId, username, channel) {
  if (Math.random() >= 0.001) return false;

  const amount = getJackpot();
  if (amount <= 0) return false;

  fs.writeFileSync(jackpotPath, JSON.stringify({ amount: 0 }, null, 2));

  const balances = fs.existsSync(balancesPath)
    ? JSON.parse(fs.readFileSync(balancesPath, 'utf8'))
    : {};
  balances[userId] = (balances[userId] || 0) + amount;
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));

  channel.send(
    `🚨🥛🚨 **J A C K P O T** 🚨🥛🚨\n\n` +
    `**${username}** just triggered the server jackpot and walked away with **${amount.toLocaleString()} milk bucks**!!!\n\n` +
    `The dairy gods have chosen. Bow down. The pot resets to zero. 🥛`
  );

  return true;
}

module.exports = { getJackpot, addToJackpot, tryJackpot };
