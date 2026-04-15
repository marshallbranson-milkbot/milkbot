const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');

function getData(p) {
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function saveData(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

module.exports = {
  name: 'give',
  description: 'Send milk bucks to another player.',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply(`who are you giving to? \`!give @user amount\` 🥛`);
    if (target.bot) return message.reply(`bots don't need milk bucks. 🥛`);
    if (target.id === message.author.id) return message.reply(`can't give milk bucks to yourself. nice try. 🥛`);

    const amount = parseInt(args[1], 10);
    if (!amount || amount < 1) return message.reply(`how much? \`!give @user amount\` 🥛`);

    const balances = getData(balancesPath);
    const senderBal = balances[message.author.id] || 0;
    if (senderBal < amount) {
      return message.reply(`you only have **${senderBal} milk bucks**. can't give what you don't have. 🥛`);
    }

    balances[message.author.id] = senderBal - amount;
    balances[target.id] = (balances[target.id] || 0) + amount;
    saveData(balancesPath, balances);

    const targetMember = message.guild?.members.cache.get(target.id);
    const targetName = targetMember?.displayName ?? target.username;

    message.channel.send(
      `💸 **${message.author.username}** sent **${amount.toLocaleString()} milk bucks** to **${targetName}**. generous. or suspicious. 🥛`
    ).catch(console.error);
  },
};
