const fs = require('fs');
const path = require('path');
const { withLock } = require('../balancelock');

const balancesPath = path.join(__dirname, '../data/balances.json');

function getData(p) {
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error('[getData] corrupted:', p); return {}; }
}
function saveData(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

async function withPairLock(idA, idB, fn) {
  const [first, second] = [idA, idB].sort();
  return withLock('bal:' + first, () => withLock('bal:' + second, fn));
}

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

    const BAL_CAP = 1_000_000_000;
    let result;
    await withPairLock(message.author.id, target.id, async () => {
      const balances = getData(balancesPath);
      const senderBal = balances[message.author.id] || 0;
      if (senderBal < amount) {
        result = { error: `you only have **${senderBal} milk bucks**. can't give what you don't have. 🥛` };
        return;
      }
      const recipientBal = balances[target.id] || 0;
      const headroom = BAL_CAP - recipientBal;
      if (headroom <= 0) {
        result = { error: `**${target.username}** is already at the balance cap. 🥛` };
        return;
      }
      const actualAmount = Math.min(amount, headroom);
      balances[message.author.id] = senderBal - actualAmount;
      balances[target.id] = recipientBal + actualAmount;
      saveData(balancesPath, balances);
      result = { ok: true, actualAmount };
    });

    if (result?.error) return message.reply(result.error);
    if (!result?.ok) return message.reply(`something went wrong. 🥛`);

    const targetMember = message.guild?.members.cache.get(target.id);
    const targetName = targetMember?.displayName ?? target.username;

    message.channel.send(
      `💸 **${message.author.username}** sent **${result.actualAmount.toLocaleString()} milk bucks** to **${targetName}**. generous. or suspicious. 🥛`
    ).catch(console.error);
  },
};
