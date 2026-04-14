const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const state = require('../state');
const ach = require('../achievements');

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
      message.delete().catch(() => {});
      message.reply(`No crate active right now. Keep an eye on the channel. 🥛`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 8000))
        .catch(() => {});
      return;
    }

    const crateMsg = state.activeCrate.msg;
    clearTimeout(state.activeCrate.expireTimeout);
    state.activeCrate = null;

    if (crateMsg) crateMsg.delete().catch(() => {});
    message.delete().catch(() => {});

    const balances = getData(balancesPath);
    balances[message.author.id] = (balances[message.author.id] || 0) + REWARD;
    saveData(balancesPath, balances);

    message.channel.send(
      `📦 **${message.author.username} claimed the milk crate!** +**${REWARD} milk bucks**! 🥛`
    );

    ach.check(message.author.id, message.author.username, 'crate_claim', { balance: balances[message.author.id] }, message.channel);
  }
};
