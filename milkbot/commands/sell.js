const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const bigTradesPath = path.join(__dirname, '../data/bigtrades.json');
const { getPrices, getPortfolios, savePortfolios, STOCK_DEFS } = require('../stockdata');
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
  name: 's',
  aliases: ['sell'],
  description: 'Sell stock. Usage: !s TICKER amount|all',
  execute(message, args) {
    const ticker = args[0]?.toUpperCase();
    const amountArg = args[1];

    if (!ticker || !validTickers.includes(ticker)) {
      return message.reply(`Invalid ticker. Valid stocks: ${validTickers.join(', ')} 🥛`);
    }

    const userId = message.author.id;
    const portfolios = getPortfolios();
    const holding = portfolios[userId]?.[ticker];

    if (!holding || holding.shares <= 0) {
      return message.reply(`You don't own any **${ticker}**. 🥛`);
    }

    const prices = getPrices();
    const price = prices[ticker].price;

    let sharesToSell;
    if (amountArg === 'all') {
      sharesToSell = holding.shares;
    } else {
      const amount = parseInt(amountArg);
      if (!amount || isNaN(amount) || amount <= 0) {
        return message.reply(`Enter a number of shares or "all". \`!sell ${ticker} shares\` 🥛`);
      }
      sharesToSell = Math.min(amount, holding.shares);
      if (sharesToSell < 1) {
        return message.reply(`You don't have that many shares of **${ticker}**. 🥛`);
      }
    }

    const revenue = sharesToSell * price;
    const spentPerShare = holding.spent / holding.shares;
    const costBasis = Math.round(spentPerShare * sharesToSell);
    const profit = revenue - costBasis;

    // Update portfolio
    holding.shares -= sharesToSell;
    holding.spent -= costBasis;
    if (holding.shares <= 0) {
      delete portfolios[userId][ticker];
    }
    savePortfolios(portfolios);

    // Update balance
    const balances = getData(balancesPath);
    balances[userId] = (balances[userId] || 0) + revenue;
    saveData(balancesPath, balances);

    const bigTrades = getData(bigTradesPath);
    if (revenue > (bigTrades[userId] || 0)) {
      bigTrades[userId] = revenue;
      saveData(bigTradesPath, bigTrades);
    }

    // Award XP on profit
    let xpGain = 0;
    if (profit > 0) {
      xpGain = Math.max(5, Math.floor(profit / 10)) * (state.doubleXp ? 2 : 1);
      const xp = getData(xpPath);
      xp[userId] = (xp[userId] || 0) + xpGain;
      saveData(xpPath, xp);
    }

    const profitStr = profit >= 0 ? `+${profit}` : `${profit}`;
    const profitEmoji = profit > 0 ? '📈' : profit < 0 ? '📉' : '➡️';

    message.reply(
      `${profitEmoji} Sold **${sharesToSell} share(s)** of **${ticker}** at **${price} 🥛** each.\n` +
      `Revenue: **${revenue} milk bucks** | P&L: **${profitStr} milk bucks**` +
      (xpGain > 0 ? ` | +**${xpGain} XP**` : '') +
      ` 🥛`
    ).then(reply => {
      setTimeout(() => reply.delete().catch(() => {}), 5 * 60 * 1000);
      setTimeout(() => message.delete().catch(() => {}), 5 * 60 * 1000);
    });
  }
};
