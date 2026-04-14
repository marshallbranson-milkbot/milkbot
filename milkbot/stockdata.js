const fs = require('fs');
const path = require('path');
const { pendingModifiers } = require('./moosnews');

const stocksPath = path.join(__dirname, 'data/stocks.json');
const portfoliosPath = path.join(__dirname, 'data/portfolios.json');
const historyPath = path.join(__dirname, 'data/pricehistory.json');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const STOCK_DEFS = [
  { ticker: 'MILK', name: 'MilkCorp Industries',   volatility: [0.02, 0.05], minPrice: 25 },
  { ticker: 'CREM', name: 'Creme Capital',          volatility: [0.02, 0.05], minPrice: 25 },
  { ticker: 'BUTR', name: 'ButterCo Holdings',      volatility: [0.05, 0.10], minPrice: 15 },
  { ticker: 'WHEY', name: 'Whey Street Group',      volatility: [0.05, 0.10], minPrice: 15 },
  { ticker: 'MOO',  name: 'Moo Markets Inc',        volatility: [0.05, 0.10], minPrice: 15 },
  { ticker: 'CHUG', name: 'Chug Enterprises',       volatility: [0.10, 0.20], minPrice: 10 },
  { ticker: 'GOT',  name: 'Got Milk Global',        volatility: [0.10, 0.20], minPrice: 10 },
  { ticker: 'SPOIL',name: 'Spoiled Rotten LLC',     volatility: [0.05, 0.30], minPrice:  5 },
];

const BASE_PRICE = 100;

function getPrices() {
  if (fs.existsSync(stocksPath)) {
    const data = JSON.parse(fs.readFileSync(stocksPath, 'utf8'));
    const allPresent = STOCK_DEFS.every(s => data[s.ticker]);
    if (allPresent) return data;
  }
  const initial = {};
  for (const s of STOCK_DEFS) {
    initial[s.ticker] = { price: BASE_PRICE, lastChange: 0 };
  }
  fs.writeFileSync(stocksPath, JSON.stringify(initial, null, 2));
  return initial;
}

function savePrices(data) {
  fs.writeFileSync(stocksPath, JSON.stringify(data, null, 2));
}

function getPortfolios() {
  if (!fs.existsSync(portfoliosPath)) return {};
  return JSON.parse(fs.readFileSync(portfoliosPath, 'utf8'));
}

function savePortfolios(data) {
  fs.writeFileSync(portfoliosPath, JSON.stringify(data, null, 2));
}

function appendHistory(prices) {
  let history = {};
  if (fs.existsSync(historyPath)) {
    try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch {}
  }
  const now = Date.now();
  const cutoff = now - SEVEN_DAYS_MS;
  for (const ticker of Object.keys(prices)) {
    if (!history[ticker]) history[ticker] = [];
    history[ticker].push({ ts: now, price: prices[ticker].price });
    history[ticker] = history[ticker].filter(e => e.ts >= cutoff);
  }
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

function getStats(ticker) {
  if (!fs.existsSync(historyPath)) return null;
  let history = {};
  try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch { return null; }
  const entries = history[ticker] || [];
  if (!entries.length) return null;
  const prices = entries.map(e => e.price);
  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
  };
}

function updatePrices() {
  const prices = getPrices();
  for (const s of STOCK_DEFS) {
    const [min, max] = s.volatility;
    const newsModifier = pendingModifiers[s.ticker] ?? pendingModifiers['ALL'] ?? 0;
    delete pendingModifiers[s.ticker];

    let change;
    if (newsModifier !== 0) {
      // News-driven tick: modifier sets direction, small noise added
      const noise = (Math.random() * 0.06) - 0.03;
      change = newsModifier + noise;
    } else {
      const pct = min + Math.random() * (max - min);
      const direction = Math.random() < 0.5 ? 1 : -1;
      change = pct * direction;
    }

    const current = prices[s.ticker].price;
    const newPrice = Math.max(s.minPrice, Math.round(current * (1 + change)));
    prices[s.ticker] = { price: newPrice, lastChange: change };
  }
  delete pendingModifiers['ALL'];
  savePrices(prices);
  appendHistory(prices);
  return prices;
}

module.exports = { STOCK_DEFS, getPrices, savePrices, getPortfolios, savePortfolios, updatePrices, getStats };
