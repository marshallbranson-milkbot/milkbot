const { getPrices, STOCK_DEFS } = require('../stockdata');

module.exports = {
  name: 'st',
  aliases: ['stocks'],
  description: 'View current milk stock prices.',
  execute(message) {
    const prices = getPrices();

    const lines = STOCK_DEFS.map(s => {
      const { price, lastChange } = prices[s.ticker];
      const pct = (lastChange * 100).toFixed(1);
      const arrow = lastChange > 0 ? '📈' : lastChange < 0 ? '📉' : '➡️';
      const sign = lastChange > 0 ? '+' : '';
      return `${arrow} **${s.ticker}** — ${price} 🥛 (${sign}${pct}%) — ${s.name}`;
    });

    message.reply(
      `**📊 MILK MARKET** 📊\n\n` +
      lines.join('\n') +
      `\n\nUse \`!buy TICKER amount\` and \`!sell TICKER amount\` to trade. 🥛`
    );
  }
};
