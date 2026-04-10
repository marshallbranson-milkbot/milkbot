const { getPrices, getPortfolios } = require('../stockdata');

module.exports = {
  name: 'port',
  aliases: ['portfolio'],
  description: 'View your stock portfolio.',
  execute(message) {
    const userId = message.author.id;
    const portfolios = getPortfolios();
    const holdings = portfolios[userId];

    if (!holdings || Object.keys(holdings).length === 0) {
      return message.reply(`You don't own any stocks. Use \`!buy TICKER amount\` to invest. 🥛`);
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

    message.reply(
      `**📊 ${message.author.username}'s Portfolio** 🥛\n\n` +
      lines.join('\n') +
      `\n\n**Total Value:** ${totalValue} milk bucks | **Total P&L:** ${totalStr} milk bucks`
    ).then(reply => {
      setTimeout(() => reply.delete().catch(() => {}), 30000);
      setTimeout(() => message.delete().catch(() => {}), 30000);
    });
  }
};
