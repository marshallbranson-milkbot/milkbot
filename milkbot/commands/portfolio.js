const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPrices, getPortfolios, savePortfolios, STOCK_DEFS } = require('../stockdata');
const ach = require('../achievements');
const state = require('../state');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const bigTradesPath = path.join(__dirname, '../data/bigtrades.json');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function executeBuy(userId, username, ticker, shares, channel) {
  const prices = getPrices();
  const price = prices[ticker].price;
  const cost = shares * price;
  const balances = getData(balancesPath);
  const balance = balances[userId] || 0;

  if (balance < cost) {
    return { success: false, msg: `Not enough milk bucks. Need **${cost}**, have **${balance}**. 🥛` };
  }

  balances[userId] = balance - cost;
  saveData(balancesPath, balances);

  const bigTrades = getData(bigTradesPath);
  if (cost > (bigTrades[userId] || 0)) { bigTrades[userId] = cost; saveData(bigTradesPath, bigTrades); }

  const portfolios = getPortfolios();
  if (!portfolios[userId]) portfolios[userId] = {};
  if (!portfolios[userId][ticker]) portfolios[userId][ticker] = { shares: 0, spent: 0, boughtAt: Date.now() };
  portfolios[userId][ticker].shares += shares;
  portfolios[userId][ticker].spent += cost;
  savePortfolios(portfolios);

  const portfolioSize = Object.keys(portfolios[userId]).length;
  const minutesSinceNews = state.lastNewsAt ? (Date.now() - state.lastNewsAt) / (1000 * 60) : 999;
  ach.check(userId, username, 'trade_made', { minutesSinceNews }, channel);
  if (portfolioSize >= 3) ach.check(userId, username, 'portfolio', { portfolioSize }, channel);

  return { success: true, msg: `✅ Bought **${shares} share(s)** of **${ticker}** at **${price} 🥛** each.\nTotal cost: **${cost} milk bucks**. New balance: **${balances[userId]} 🥛**` };
}

function executeSell(userId, username, ticker, sharesToSell, channel) {
  const portfolios = getPortfolios();
  const holding = portfolios[userId]?.[ticker];
  if (!holding || holding.shares <= 0) return { success: false, msg: `You don't own any **${ticker}**. 🥛` };

  const prices = getPrices();
  const price = prices[ticker].price;
  const actualShares = Math.min(sharesToSell, holding.shares);
  const revenue = actualShares * price;
  const spentPerShare = holding.spent / holding.shares;
  const costBasis = Math.round(spentPerShare * actualShares);
  const profit = revenue - costBasis;
  const profitRatio = costBasis > 0 ? profit / costBasis : 0;
  const heldHours = holding.boughtAt ? (Date.now() - holding.boughtAt) / (1000 * 60 * 60) : 0;

  holding.shares -= actualShares;
  holding.spent -= costBasis;
  if (holding.shares <= 0) delete portfolios[userId][ticker];
  savePortfolios(portfolios);

  const balances = getData(balancesPath);
  balances[userId] = (balances[userId] || 0) + revenue;
  saveData(balancesPath, balances);

  const bigTrades = getData(bigTradesPath);
  if (revenue > (bigTrades[userId] || 0)) { bigTrades[userId] = revenue; saveData(bigTradesPath, bigTrades); }

  let xpGain = 0;
  if (profit > 0) {
    xpGain = Math.min(200, Math.max(5, Math.floor(profit / 10)) * (state.doubleXp ? 2 : 1));
    const xp = getData(xpPath);
    xp[userId] = Math.min(30000, (xp[userId] || 0) + xpGain);
    saveData(xpPath, xp);
  }

  const profitStr = profit >= 0 ? `+${profit}` : `${profit}`;
  const profitEmoji = profit > 0 ? '📈' : profit < 0 ? '📉' : '➡️';
  ach.check(userId, username, 'sell_result', { profit, profitRatio, heldHours, balance: balances[userId] }, channel);

  return {
    success: true,
    msg: `${profitEmoji} Sold **${actualShares} share(s)** of **${ticker}** at **${price} 🥛** each.\nRevenue: **${revenue} milk bucks** | P&L: **${profitStr} milk bucks**` +
      (xpGain > 0 ? ` | +**${xpGain} XP**` : '') + ` 🥛`
  };
}

module.exports = {
  name: 'port',
  aliases: ['portfolio'],
  description: 'View your stock portfolio.',

  async execute(message) {
    const userId = message.author.id;
    const portfolios = getPortfolios();
    const holdings = portfolios[userId];

    if (!holdings || Object.keys(holdings).length === 0) {
      return message.reply(`You don't own any stocks. Use \`!b TICKER shares\` to invest. 🥛`);
    }

    const prices = getPrices();
    let totalValue = 0;
    let totalSpent = 0;

    const lines = Object.entries(holdings).map(([ticker, { shares, spent }]) => {
      const price = prices[ticker]?.price || 0;
      const currentValue = shares * price;
      const profit = currentValue - spent;
      const profitStr = profit >= 0 ? `+${profit}` : `${profit}`;
      const arrow = profit > 0 ? '📈' : profit < 0 ? '📉' : '➡️';
      totalValue += currentValue;
      totalSpent += spent;
      return `${arrow} **${ticker}** — ${shares} share(s) @ ${price} 🥛 = **${currentValue} milk bucks** (${profitStr})`;
    });

    const totalProfit = totalValue - totalSpent;
    const totalStr = totalProfit >= 0 ? `+${totalProfit}` : `${totalProfit}`;
    const balance = getData(balancesPath)[userId] || 0;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`port_select_${userId}`)
      .setPlaceholder('Pick a stock to act on...')
      .addOptions(
        Object.entries(holdings).map(([ticker, { shares }]) => {
          const price = prices[ticker]?.price || 0;
          return new StringSelectMenuOptionBuilder()
            .setLabel(`${ticker} — ${shares} share(s) @ ${price} 🥛`)
            .setValue(ticker);
        })
      );

    const reply = await message.reply({
      content:
        `**📊 ${message.author.username}'s Portfolio** 🥛\n\n` +
        lines.join('\n') +
        `\n\n**Total Value:** ${totalValue} milk bucks | **Total P&L:** ${totalStr} milk bucks` +
        `\n**Balance:** ${balance} milk bucks 🥛` +
        `\n\n*Select a stock below to buy more or sell:*`,
      components: [new ActionRowBuilder().addComponents(selectMenu)],
    });

    setTimeout(() => {
      reply.edit({ components: [] }).catch(() => {});
      reply.delete().catch(() => {});
      message.delete().catch(() => {});
    }, 60000);
  },

  async handleSelectMenu(interaction) {
    const parts = interaction.customId.split('_'); // ['port', 'select', 'userId']
    const ownerId = parts[2];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: `that's not your portfolio chief 🥛`, ephemeral: true });
    }

    const ticker = interaction.values[0];
    const userId = ownerId;
    const prices = getPrices();
    const price = prices[ticker]?.price || 0;
    const portfolios = getPortfolios();
    const holding = portfolios[userId]?.[ticker];
    const balance = getData(balancesPath)[userId] || 0;
    const maxBuy = price > 0 ? Math.floor(balance / price) : 0;

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`port_buyall_${ticker}_${userId}`)
        .setLabel(`Buy All — ${maxBuy} shares`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(maxBuy === 0),
      new ButtonBuilder()
        .setCustomId(`port_sellall_${ticker}_${userId}`)
        .setLabel(`Sell All — ${holding?.shares || 0} shares`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!holding || holding.shares <= 0),
      new ButtonBuilder()
        .setCustomId(`port_buyamt_${ticker}_${userId}`)
        .setLabel('Buy Amount')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(maxBuy === 0),
      new ButtonBuilder()
        .setCustomId(`port_sellamt_${ticker}_${userId}`)
        .setLabel('Sell Amount')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!holding || holding.shares <= 0),
    );

    await interaction.reply({
      content: `**${ticker}** — Price: **${price} 🥛** | Balance: **${balance} milk bucks**`,
      components: [buttons],
      ephemeral: true,
    });
  },

  async handleButtonInteraction(interaction) {
    const parts = interaction.customId.split('_'); // ['port', 'buyall'/'sellall', 'TICKER', 'userId']
    const action = parts[1];
    const ticker = parts[2];
    const ownerId = parts[3];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: `that's not your portfolio chief 🥛`, ephemeral: true });
    }

    await interaction.deferUpdate();

    const userId = ownerId;
    const username = interaction.user.username;
    const channel = interaction.channel;

    if (action === 'buyall') {
      const price = getPrices()[ticker]?.price || 0;
      const balance = getData(balancesPath)[userId] || 0;
      const shares = price > 0 ? Math.floor(balance / price) : 0;

      if (shares === 0) {
        return interaction.followUp({ content: `Not enough milk bucks to buy any **${ticker}** at **${price} 🥛**. 🥛`, ephemeral: true });
      }

      const result = executeBuy(userId, username, ticker, shares, channel);
      interaction.followUp({ content: result.msg, ephemeral: true });

    } else if (action === 'sellall') {
      const portfolios = getPortfolios();
      const holding = portfolios[userId]?.[ticker];

      if (!holding || holding.shares <= 0) {
        return interaction.followUp({ content: `You don't own any **${ticker}**. 🥛`, ephemeral: true });
      }

      const result = executeSell(userId, username, ticker, holding.shares, channel);
      interaction.followUp({ content: result.msg, ephemeral: true });

    } else if (action === 'buyamt' || action === 'sellamt') {
      await interaction.followUp({ content: `💬 How many shares? Reply with a number in the next 30 seconds.`, ephemeral: true });

      const filter = m => m.author.id === userId;
      const collected = await channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);

      if (!collected || collected.size === 0) {
        return interaction.followUp({ content: `timed out. no trade made. 🥛`, ephemeral: true });
      }

      const reply = collected.first();
      const shares = parseInt(reply.content.trim(), 10);
      reply.delete().catch(() => {});

      if (!shares || shares <= 0) {
        return interaction.followUp({ content: `that's not a valid number. no trade made. 🥛`, ephemeral: true });
      }

      const result = action === 'buyamt'
        ? executeBuy(userId, username, ticker, shares, channel)
        : executeSell(userId, username, ticker, shares, channel);
      interaction.followUp({ content: result.msg, ephemeral: true });
    }
  },
};
