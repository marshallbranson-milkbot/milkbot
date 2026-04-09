const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const cooldownsPath = path.join(__dirname, '../data/cooldowns.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours
const SUCCESS_CHANCE = 0.3333;

module.exports = {
  name: 'ro',
  aliases: ['rob'],
  description: 'Rob someone. Usage: !ro @user',
  execute(message, args) {
    const target = message.mentions.users.first();

    if (!target) {
      return message.reply(`You need to tag someone. \`!ro @user\` 🥛`);
    }

    if (target.bot) {
      return message.reply(`You can't rob a bot. Nice try. 🥛`);
    }

    if (target.id === message.author.id) {
      return message.reply(`You can't rob yourself. 🥛`);
    }

    const cooldowns = getData(cooldownsPath);
    const now = Date.now();
    const lastRob = cooldowns[`rob_${message.author.id}`] || 0;
    const timeLeft = COOLDOWN - (now - lastRob);

    if (timeLeft > 0) {
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      return message.reply(`You're laying low. Try again in **${hours}h ${minutes}m**. 🥛`);
    }

    const balances = getData(balancesPath);
    const robberBalance = balances[message.author.id] || 0;
    const targetBalance = balances[target.id] || 0;

    if (targetBalance <= 0) {
      return message.reply(`${target.username} is broke. Not worth it. 🥛`);
    }

    if (robberBalance <= 0) {
      return message.reply(`You're broke. You've got nothing to lose but you also can't pull this off. 🥛`);
    }

    cooldowns[`rob_${message.author.id}`] = now;
    saveData(cooldownsPath, cooldowns);

    const success = Math.random() < SUCCESS_CHANCE;

    if (success) {
      const stolen = Math.max(1, Math.floor(targetBalance * 0.05));
      balances[message.author.id] = robberBalance + stolen;
      balances[target.id] = targetBalance - stolen;
      saveData(balancesPath, balances);

      const xp = getData(xpPath);
      xp[message.author.id] = (xp[message.author.id] || 0) + (50 * (state.doubleXp ? 2 : 1));
      saveData(xpPath, xp);

      message.channel.send(
        `🕵️ **ROB SUCCESSFUL** 🕵️\n` +
        `${message.author.username} snuck into ${target.username}'s wallet and walked away with **${stolen} milk bucks**. Slick. 🥛`
      );
    } else {
      const penalty = Math.max(1, Math.floor(robberBalance * 0.10));
      balances[message.author.id] = robberBalance - penalty;
      balances[target.id] = targetBalance + penalty;
      saveData(balancesPath, balances);

      message.channel.send(
        `🚨 **ROB FAILED** 🚨\n` +
        `${message.author.username} got caught trying to rob ${target.username} and had to pay **${penalty} milk bucks** as a fine. Embarrassing. 🥛`
      );
    }
  }
};
