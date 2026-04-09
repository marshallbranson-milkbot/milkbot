const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const state = require('../state');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const REWARD = 500;

module.exports = {
  name: 'cc',
  description: 'Claim an active milk crate drop.',
  execute(message) {
    if (!state.activeCrate) {
      return message.reply(`No crate active right now. Keep an eye on the channel. 🥛`);
    }

    clearTimeout(state.activeCrate.expireTimeout);
    state.activeCrate = null;

    const balances = getData(balancesPath);
    balances[message.author.id] = (balances[message.author.id] || 0) + REWARD;
    saveData(balancesPath, balances);

    message.channel.send(
      `📦 **${message.author.username} claimed the milk crate!** +**${REWARD} milk bucks**! 🥛`
    );
  }
};
