const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const bigTradesPath = path.join(__dirname, '../data/bigtrades.json');
const { getPrices, getPortfolios, savePortfolios, STOCK_DEFS } = require('../stockdata');
const ach = require('../achievements');
const state = require('../state');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const validTickers = STOCK_DEFS.map(s => s.ticker);

module.exports = {
  name: 'b',
  aliases: ['buy'],
  description: 'Buy stock shares.',
  slashOptions: [
    { name: 'ticker', description: 'Stock ticker (e.g. MILK)', type: 'STRING', required: true },
    { name: 'shares', description: 'Number of shares to buy', type: 'INTEGER', required: true },
  ],
  execute(message, args) {
    const ticker = args[0]?.toUpperCase();
    const amount = parseInt(args[1]);

    if (!ticker || !validTickers.includes(ticker)) {
      return message.reply(`Invalid ticker. Valid stocks: ${validTickers.join(', ')} 🥛`);
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return message.reply(`Enter a number of shares. \`!buy ${ticker} shares\` 🥛`);
    }

    const prices = getPrices();
    const price = prices[ticker].price;
    const shares = amount;
    const cost = shares * price;
    const userId = message.author.id;
    const balances = getData(balancesPath);
    const balance = balances[userId] || 0;

    if (balance < cost) {
      return message.reply(`You need **${cost} milk bucks** for ${shares} share(s). You've got **${balance}**. 🥛`);
    }

    balances[userId] = balance - cost;
    saveData(balancesPath, balances);

    const bigTrades = getData(bigTradesPath);
    if (cost > (bigTrades[userId] || 0)) {
      bigTrades[userId] = cost;
      saveData(bigTradesPath, bigTrades);
    }

    const portfolios = getPortfolios();
    if (!portfolios[userId]) portfolios[userId] = {};
    if (!portfolios[userId][ticker]) portfolios[userId][ticker] = { shares: 0, spent: 0, boughtAt: Date.now() };
    portfolios[userId][ticker].shares += shares;
    portfolios[userId][ticker].spent += cost;
    savePortfolios(portfolios);

    const portfolioSize = Object.keys(portfolios[userId]).length;
    const minutesSinceNews = state.lastNewsAt ? (Date.now() - state.lastNewsAt) / (1000 * 60) : 999;
    ach.check(userId, message.author.username, 'trade_made', { minutesSinceNews }, message.channel);
    if (portfolioSize >= 3) ach.check(userId, message.author.username, 'portfolio', { portfolioSize }, message.channel);

    message.reply(
      `✅ Bought **${shares} share(s)** of **${ticker}** at **${price} 🥛** each.\n` +
      `Total cost: **${cost} milk bucks**. New balance: **${balances[userId]} 🥛**`
    ).then(reply => {
      setTimeout(() => reply.delete().catch(() => {}), 5 * 60 * 1000);
      setTimeout(() => message.delete().catch(() => {}), 5 * 60 * 1000);
    });
  }
};
