// End-to-end playtest for the stocks + port system.
// Runs against isolated test data (does NOT touch real balances.json / portfolios.json).
// node test-stocks.js

const fs = require('fs');
const path = require('path');
const os = require('os');

// Swap in temp data files for isolation — restore originals on exit.
// Backups go to OS tempdir so leaked backups never clutter the repo's data/.
const DATA_DIR = path.join(__dirname, 'data');
const REAL_BAL = path.join(DATA_DIR, 'balances.json');
const REAL_PORT = path.join(DATA_DIR, 'portfolios.json');
const TMP_PREFIX = path.join(os.tmpdir(), `milkbot-test-${process.pid}-${Date.now()}`);
const BACKUP_BAL = TMP_PREFIX + '-balances.json';
const BACKUP_PORT = TMP_PREFIX + '-portfolios.json';

function backup() {
  if (fs.existsSync(REAL_BAL)) fs.copyFileSync(REAL_BAL, BACKUP_BAL);
  if (fs.existsSync(REAL_PORT)) fs.copyFileSync(REAL_PORT, BACKUP_PORT);
}
function restore() {
  if (fs.existsSync(BACKUP_BAL)) { fs.copyFileSync(BACKUP_BAL, REAL_BAL); fs.unlinkSync(BACKUP_BAL); }
  else if (fs.existsSync(REAL_BAL)) fs.unlinkSync(REAL_BAL);
  if (fs.existsSync(BACKUP_PORT)) { fs.copyFileSync(BACKUP_PORT, REAL_PORT); fs.unlinkSync(BACKUP_PORT); }
  else if (fs.existsSync(REAL_PORT)) fs.unlinkSync(REAL_PORT);
}

backup();
process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });

// Start with clean test data
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(REAL_BAL, JSON.stringify({}));
fs.writeFileSync(REAL_PORT, JSON.stringify({}));

// Stub channel object for ach.check() calls
const stubChannel = { send: () => Promise.resolve({}), client: { users: { fetch: () => Promise.resolve({ send: () => Promise.resolve() }) } } };

const portfolio = require('./commands/portfolio');
const { getPrices, getPortfolios, savePortfolios, STOCK_DEFS } = require('./stockdata');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}

function readBal(userId) {
  try { return JSON.parse(fs.readFileSync(REAL_BAL, 'utf8'))[userId] || 0; } catch { return 0; }
}
function setBal(userId, amount) {
  const d = JSON.parse(fs.readFileSync(REAL_BAL, 'utf8'));
  d[userId] = amount;
  fs.writeFileSync(REAL_BAL, JSON.stringify(d, null, 2));
}
function readPort(userId) {
  return JSON.parse(fs.readFileSync(REAL_PORT, 'utf8'))[userId] || {};
}

const USER = 'test-user-1';
const TICKER = 'MILK';
const prices = getPrices();
const milkPrice = prices[TICKER].price;

console.log(`\n━━━ STOCK & PORT PLAYTEST ━━━`);
console.log(`MILK current price: ${milkPrice} 🥛\n`);

console.log('▶ TEST 1 — Buy 50 shares from fresh state');
setBal(USER, 100000);
const buy1 = portfolio._executeBuy(USER, 'TestUser', TICKER, 50, stubChannel);
assert(buy1.success === true, 'buy returns success');
const expectedCost = 50 * milkPrice;
assert(readBal(USER) === 100000 - expectedCost, `balance decreased by ${expectedCost}`);
const port1 = readPort(USER);
assert(port1[TICKER] && port1[TICKER].shares === 50, 'portfolio has 50 shares');
assert(port1[TICKER].spent === expectedCost, `portfolio.spent = ${expectedCost}`);

console.log('\n▶ TEST 2 — /port shows non-empty payload');
const payload = portfolio._buildPortfolioPayload(USER, 'TestUser');
assert(!payload.empty, '/port payload not empty');
assert(payload.content.includes(TICKER), 'content mentions MILK');
assert(payload.content.includes('50 share'), 'content shows 50 shares');

console.log('\n▶ TEST 3 — Sell 25 shares');
const balBeforeSell = readBal(USER);
const sell1 = portfolio._executeSell(USER, 'TestUser', TICKER, 25, stubChannel);
assert(sell1.success === true, 'sell returns success');
const expectedRevenue = 25 * milkPrice;
assert(readBal(USER) === balBeforeSell + expectedRevenue, `balance increased by ${expectedRevenue}`);
const port2 = readPort(USER);
assert(port2[TICKER].shares === 25, 'portfolio has 25 shares remaining');

console.log('\n▶ TEST 4 — Sell remaining 25, holding should delete');
portfolio._executeSell(USER, 'TestUser', TICKER, 25, stubChannel);
const port3 = readPort(USER);
assert(!port3[TICKER], 'holding removed from portfolio when shares=0');

console.log('\n▶ TEST 5 — /port shows empty when no holdings');
const emptyPayload = portfolio._buildPortfolioPayload(USER, 'TestUser');
assert(emptyPayload.empty === true, '/port returns empty=true when no holdings');

console.log('\n▶ TEST 6 — Sell nonexistent ticker');
const failSell = portfolio._executeSell(USER, 'TestUser', 'MILK', 10, stubChannel);
assert(failSell.success === false, "sell fails cleanly when user doesn't own stock");

console.log('\n▶ TEST 7 — Buy with insufficient balance');
setBal(USER, 10);
const failBuy = portfolio._executeBuy(USER, 'TestUser', TICKER, 50, stubChannel);
assert(failBuy.success === false, 'buy fails cleanly when broke');
assert(readBal(USER) === 10, 'balance unchanged after failed buy');

console.log('\n▶ TEST 8 — Corrupt portfolio self-heals on /port');
setBal(USER, 0);
const port = getPortfolios();
port[USER] = {
  MILK: { shares: 10, spent: 500, boughtAt: Date.now() },
  BADKEY: 'garbage string',
  NAN: { shares: NaN, spent: 100 },
  ZERO: { shares: 0, spent: 0 },
  NULLHOLD: null,
};
savePortfolios(port);
const healed = portfolio._buildPortfolioPayload(USER, 'TestUser');
assert(!healed.empty, 'corrupt portfolio still renders valid /port');
const portAfter = readPort(USER);
assert(Object.keys(portAfter).length === 1 && portAfter.MILK, 'corrupt entries cleaned, MILK survives');

console.log('\n▶ TEST 9 — Corrupt portfolio with only garbage → /port empty');
port[USER] = { BADKEY: 'garbage', NULLHOLD: null };
savePortfolios(port);
const allBad = portfolio._buildPortfolioPayload(USER, 'TestUser');
assert(allBad.empty === true, 'all-garbage portfolio returns empty');

console.log('\n▶ TEST 10 — Buy, sell with profit calc');
setBal(USER, 100000);
portfolio._executeBuy(USER, 'TestUser', TICKER, 10, stubChannel);
// manually adjust the spent to simulate buying cheaper before
const portFor10 = getPortfolios();
portFor10[USER][TICKER].spent = 500; // basis 50/share
savePortfolios(portFor10);
const sellProfit = portfolio._executeSell(USER, 'TestUser', TICKER, 10, stubChannel);
assert(sellProfit.success === true, 'sell with cost-basis < revenue succeeds');

console.log('\n▶ TEST 11 — Rapid buy/sell cycles preserve balance consistency');
const startBal = 100000;
setBal(USER, startBal);
for (let i = 0; i < 20; i++) {
  portfolio._executeBuy(USER, 'TestUser', TICKER, 5, stubChannel);
  portfolio._executeSell(USER, 'TestUser', TICKER, 5, stubChannel);
}
// After 20 round-trips at fixed price, balance should equal startBal (minus round-off)
const endBal = readBal(USER);
const delta = Math.abs(endBal - startBal);
assert(delta < 5, `20 round-trips preserve balance (delta=${delta})`);

console.log('\n━━━ RESULT ━━━');
console.log(`Passed: ${passed}   Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
