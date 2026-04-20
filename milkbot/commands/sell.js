const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const bigTradesPath = path.join(__dirname, '../data/bigtrades.json');
const { getPrices, getPortfolios, savePortfolios, STOCK_DEFS } = require('../stockdata');
const state = require('../state');
const ach = require('../achievements');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { console.error('[getData] corrupted:', filePath); return {}; }
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const validTickers = STOCK_DEFS.map(s => s.ticker);

module.exports = {
  name: 's',
  aliases: ['sell'],
  description: 'Sell stock shares.',
  slashOptions: [
    { name: 'ticker', description: 'Stock ticker (e.g. MILK)', type: 'STRING', required: true },
    { name: 'amount', description: 'Number of shares, or "all"', type: 'STRING', required: true },
  ],
  execute(message, args) {
    const ticker = args[0]?.toUpperCase();
    const amountArg = args[1];

    if (!ticker || !validTickers.includes(ticker)) {
      return message.reply(`Invalid ticker. Valid stocks: ${validTickers.join(', ')} 🥛`);
    }

    const userId = message.author.id;
    const portfolios = getPortfolios();
    const holding = portfolios[userId]?.[ticker];

    // Normalize legacy/corrupt fields defensively — missing spent, NaN shares, etc. would
    // silently break the sell path otherwise.
    if (!holding) {
      return message.reply(`You don't own any **${ticker}**. 🥛`);
    }
    if (!Number.isFinite(holding.shares) || holding.shares <= 0) {
      // Clean up zombie holding so it doesn't block future buys/sells
      delete portfolios[userId][ticker];
      savePortfolios(portfolios);
      return message.reply(`You don't own any **${ticker}**. 🥛`);
    }
    if (!Number.isFinite(holding.spent) || holding.spent < 0) {
      holding.spent = 0;  // treat as pure profit
    }

    const prices = getPrices();
    const priceEntry = prices[ticker];
    if (!priceEntry || !Number.isFinite(priceEntry.price)) {
      console.error(`[sell] missing price for ${ticker}, user=${userId}`);
      return message.reply(`**${ticker}** has no current price. Try again in a minute. 🥛`);
    }
    const price = priceEntry.price;

    let sharesToSell;
    if (amountArg === 'all') {
      sharesToSell = holding.shares;
    } else {
      const amount = parseInt(amountArg, 10);
      if (!amount || isNaN(amount) || amount <= 0) {
        return message.reply(`Enter a number of shares or "all". \`!sell ${ticker} shares\` 🥛`);
      }
      sharesToSell = Math.min(amount, holding.shares);
      if (sharesToSell < 1) {
        return message.reply(`You don't have that many shares of **${ticker}**. 🥛`);
      }
    }

    const revenue = Math.max(0, Math.round(sharesToSell * price));
    const spentPerShare = holding.spent / holding.shares;
    const costBasis = Math.max(0, Math.round(spentPerShare * sharesToSell));
    const profit = revenue - costBasis;
    const profitRatio = costBasis > 0 ? profit / costBasis : 0;
    const heldHours = holding.boughtAt ? (Date.now() - holding.boughtAt) / (1000 * 60 * 60) : 0;

    if (!Number.isFinite(revenue)) {
      console.error(`[sell] invalid revenue`, { userId, ticker, price, sharesToSell, holding });
      return message.reply(`something's off with your **${ticker}** position — tell an admin. 🥛`);
    }

    // Update portfolio
    holding.shares -= sharesToSell;
    holding.spent = Math.max(0, holding.spent - costBasis);
    if (holding.shares <= 0) {
      delete portfolios[userId][ticker];
    }
    savePortfolios(portfolios);

    // Update balance
    const balances = getData(balancesPath);
    balances[userId] = Math.min(1_000_000_000, (balances[userId] || 0) + revenue);
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
      xp[userId] = Math.min(require('../prestige').getXpCap(userId), (xp[userId] || 0) + xpGain);
      saveData(xpPath, xp);
    }

    const profitStr = profit >= 0 ? `+${profit}` : `${profit}`;
    const profitEmoji = profit > 0 ? '📈' : profit < 0 ? '📉' : '➡️';

    ach.check(userId, message.author.username, 'sell_result', { profit, profitRatio, heldHours, balance: balances[userId] }, message.channel);

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
