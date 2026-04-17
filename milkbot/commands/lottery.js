const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const lotteryPath  = path.join(__dirname, '../data/lottery.json');

const TICKET_PRICE = 10;
const GUILD_ID     = '562076997979865118';

function getData(p) {
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function saveData(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

function getLottery() {
  if (!fs.existsSync(lotteryPath)) return makeFreshLottery();
  try { return JSON.parse(fs.readFileSync(lotteryPath, 'utf8')); } catch { return makeFreshLottery(); }
}

function makeFreshLottery() {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return { drawTimestamp: midnight.getTime(), pot: 0, entries: [] };
}

function saveLottery(data) { fs.writeFileSync(lotteryPath, JSON.stringify(data, null, 2)); }

function msUntilDraw(drawTimestamp) {
  return Math.max(0, drawTimestamp - Date.now());
}

function formatTimeUntil(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function drawLottery(client) {
  const lottery = getLottery();
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  if (lottery.lastDrawDate === todayStr) {
    console.log('[lottery] already drew today, skipping duplicate draw');
    const fresh = makeFreshLottery();
    saveLottery(fresh);
    setTimeout(() => drawLottery(client), msUntilDraw(fresh.drawTimestamp));
    return;
  }
  const guild = client.guilds.cache.get(GUILD_ID);
  const channel = guild?.channels.cache.find(c => c.name === 'milkbot-games');

  if (!lottery.entries || lottery.entries.length === 0) {
    if (channel) {
      await channel.send(`🎟️ **LOTTERY DRAWING** — nobody bought a ticket. free money moment wasted. 🥛`).catch(() => {});
    }
  } else {
    // Pick winner — each entry is one ticket so distribution is naturally weighted
    const winnerIndex = Math.floor(Math.random() * lottery.entries.length);
    const winnerId = lottery.entries[winnerIndex];
    const prize = lottery.pot;

    const balances = getData(balancesPath);
    balances[winnerId] = (balances[winnerId] || 0) + prize;
    saveData(balancesPath, balances);

    // Get winner display name
    let winnerName = 'Someone';
    try {
      const member = guild?.members.cache.get(winnerId) || await guild?.members.fetch(winnerId).catch(() => null);
      if (member) winnerName = member.displayName;
    } catch {}

    // Count unique players and their ticket counts
    const ticketCounts = {};
    for (const uid of lottery.entries) ticketCounts[uid] = (ticketCounts[uid] || 0) + 1;
    const totalTickets = lottery.entries.length;
    const playerCount  = Object.keys(ticketCounts).length;
    const winnerTickets = ticketCounts[winnerId] || 1;
    const odds = ((winnerTickets / totalTickets) * 100).toFixed(1);

    if (channel) {
      await channel.send(
        `🎟️ **LOTTERY DRAWING** 🎟️\n\n` +
        `🥛 **${winnerName}** wins **${prize.toLocaleString()} milk bucks**!\n` +
        `*(${winnerTickets} ticket${winnerTickets !== 1 ? 's' : ''} out of ${totalTickets} — ${odds}% odds · ${playerCount} player${playerCount !== 1 ? 's' : ''} entered)*\n\n` +
        `get your tickets in tomorrow with \`!lt <tickets>\` 🎟️`
      ).catch(() => {});
    }
  }

  // Reset and schedule next draw
  const fresh = makeFreshLottery();
  fresh.lastDrawDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  saveLottery(fresh);
  setTimeout(() => drawLottery(client), msUntilDraw(fresh.drawTimestamp));
}

async function init(client) {
  const lottery = getLottery();
  const remaining = msUntilDraw(lottery.drawTimestamp);
  if (remaining <= 0) {
    // Draw was missed (bot was down at midnight)
    await drawLottery(client);
  } else {
    setTimeout(() => drawLottery(client), remaining);
    console.log(`[lottery] draw in ${formatTimeUntil(remaining)}`);
  }
}

module.exports = {
  name: 'lt',
  aliases: ['lottery'],
  description: 'Buy lottery tickets. 10 milk bucks each. One winner drawn at midnight.',
  init,
  async execute(message, args) {
    const count = parseInt(args[0], 10);
    if (!count || count < 1) {
      return message.reply(`tell me how many tickets. \`!lt <tickets>\` — 10 milk bucks each 🎟️`);
    }

    const cost    = count * TICKET_PRICE;
    const userId  = message.author.id;
    const balances = getData(balancesPath);
    const balance  = balances[userId] || 0;

    if (balance < cost) {
      return message.reply(`that costs **${cost} milk bucks** and you only have **${balance}**. buy fewer tickets. 🥛`);
    }

    balances[userId] = balance - cost;
    saveData(balancesPath, balances);

    const lottery = getLottery();
    for (let i = 0; i < count; i++) lottery.entries.push(userId);
    lottery.pot += cost;
    saveLottery(lottery);

    const remaining = msUntilDraw(lottery.drawTimestamp);
    const timeStr   = formatTimeUntil(remaining);

    // Count this user's total tickets
    const myTickets = lottery.entries.filter(id => id === userId).length;

    message.reply(
      `🎟️ got it — **${count} ticket${count !== 1 ? 's' : ''}** added. you now have **${myTickets}** in the pot.\n` +
      `🥛 **current pot: ${lottery.pot.toLocaleString()} milk bucks** — drawing in **${timeStr}**`
    ).catch(console.error);
  },
};
