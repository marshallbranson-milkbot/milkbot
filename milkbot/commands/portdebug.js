// /portdebug — owner-only admin tool to inspect/repair/reset a user's portfolio.
// Not intended for players; gated to the bot owner user ID.

const fs = require('fs');
const path = require('path');
const { getPrices, getPortfolios, savePortfolios } = require('../stockdata');
const { withLock } = require('../balancelock');

const OWNER_ID = process.env.DUNGEON_ADMIN_ID || '879171470700445747';
const balancesPath = path.join(__dirname, '../data/balances.json');

function getData(p) {
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}
function saveData(p, d) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, p);
}

async function executeSlash(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: 'Not for you.', flags: 64 });
  }
  const action = (interaction.options.getString('action') || '').trim().toLowerCase();
  const targetId = (interaction.options.getString('userid') || '').trim();

  if (!targetId || !/^\d+$/.test(targetId)) {
    return interaction.reply({ content: 'userid must be a numeric Discord user ID', flags: 64 });
  }

  if (action === 'dump') {
    const portfolios = getPortfolios();
    const balances = getData(balancesPath);
    const port = portfolios[targetId] ?? null;
    const bal = balances[targetId] ?? 0;
    const body = `**Portfolio dump for** \`${targetId}\`\n**Balance:** ${bal.toLocaleString()} 🥛\n**Portfolio JSON:**\n\`\`\`json\n${JSON.stringify(port, null, 2).slice(0, 1700)}\n\`\`\``;
    return interaction.reply({ content: body, flags: 64 });
  }

  if (action === 'reset') {
    const prices = getPrices();
    let refund = 0;
    let tickerSummary = [];
    await withLock('bal:' + targetId, async () => {
      const portfolios = getPortfolios();
      const holdings = portfolios[targetId] || {};
      for (const [ticker, h] of Object.entries(holdings)) {
        if (!h || typeof h !== 'object') continue;
        const shares = Number(h.shares) || 0;
        const price = prices[ticker]?.price || 0;
        if (shares > 0 && price > 0) {
          const value = Math.floor(shares * price);
          refund += value;
          tickerSummary.push(`${ticker} ${shares}×${price}=${value}`);
        }
      }
      delete portfolios[targetId];
      savePortfolios(portfolios);

      const balances = getData(balancesPath);
      balances[targetId] = Math.min(1_000_000_000, (balances[targetId] || 0) + refund);
      saveData(balancesPath, balances);
    });
    return interaction.reply({
      content: `🧹 Portfolio reset for \`${targetId}\`\nRefunded **${refund.toLocaleString()}** 🥛\nHoldings wiped: ${tickerSummary.join(', ') || '(none)'}`,
      flags: 64,
    });
  }

  if (action === 'repair') {
    // Run the v3 normalization logic on just this user
    const { STOCK_DEFS } = require('../stockdata');
    const validTickers = new Set(STOCK_DEFS.map(s => s.ticker));
    const portfolios = getPortfolios();
    const holdings = portfolios[targetId];
    if (!holdings || typeof holdings !== 'object') {
      return interaction.reply({ content: `\`${targetId}\` has no portfolio object to repair.`, flags: 64 });
    }
    let fixed = 0;
    for (const ticker of Object.keys(holdings)) {
      let h = holdings[ticker];
      if (!validTickers.has(ticker)) { delete holdings[ticker]; fixed++; continue; }
      if (!h || typeof h !== 'object') { delete holdings[ticker]; fixed++; continue; }
      const shares = Number(h.shares);
      const spent = Number(h.spent);
      const boughtAt = Number(h.boughtAt);
      if (!Number.isFinite(shares) || shares <= 0) { delete holdings[ticker]; fixed++; continue; }
      h.shares = Math.floor(shares);
      h.spent = Number.isFinite(spent) && spent >= 0 ? Math.floor(spent) : 0;
      h.boughtAt = Number.isFinite(boughtAt) ? boughtAt : Date.now();
      fixed++;
    }
    if (Object.keys(holdings).length === 0) delete portfolios[targetId];
    savePortfolios(portfolios);
    return interaction.reply({ content: `🔧 Repaired \`${targetId}\` (${fixed} fixes applied)`, flags: 64 });
  }

  return interaction.reply({ content: 'actions: `dump | repair | reset`', flags: 64 });
}

module.exports = {
  name: 'portdebug',
  description: 'Admin-only portfolio diagnostic tool',
  slashOptions: [
    { name: 'action', description: 'dump | repair | reset', type: 'STRING', required: true },
    { name: 'userid', description: 'target Discord user ID', type: 'STRING', required: true },
  ],
  executeSlash,
  execute: () => {},
};
