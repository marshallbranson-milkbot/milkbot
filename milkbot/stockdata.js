const fs = require('fs');
const path = require('path');

const stocksPath = path.join(__dirname, 'data/stocks.json');
const portfoliosPath = path.join(__dirname, 'data/portfolios.json');

const STOCK_DEFS = [
  { ticker: 'MILK', name: 'MilkCorp Industries',   volatility: [0.02, 0.05] },
  { ticker: 'CREM', name: 'Creme Capital',          volatility: [0.02, 0.05] },
  { ticker: 'BUTR', name: 'ButterCo Holdings',      volatility: [0.05, 0.10] },
  { ticker: 'WHEY', name: 'Whey Street Group',      volatility: [0.05, 0.10] },
  { ticker: 'MOO',  name: 'Moo Markets Inc',        volatility: [0.05, 0.10] },
  { ticker: 'CHUG', name: 'Chug Enterprises',       volatility: [0.10, 0.20] },
  { ticker: 'GOT',  name: 'Got Milk Global',        volatility: [0.10, 0.20] },
  { ticker: 'SPOIL',name: 'Spoiled Rotten LLC',     volatility: [0.05, 0.30] },
];

const BASE_PRICE = 100;

function getPrices() {
  if (!fs.existsSync(stocksPath)) {
    const initial = {};
    for (const s of STOCK_DEFS) {
      initial[s.ticker] = { price: BASE_PRICE, lastChange: 0 };
    }
    fs.writeFileSync(stocksPath, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(stocksPath, 'utf8'));
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

function updatePrices() {
  const prices = getPrices();
  for (const s of STOCK_DEFS) {
    const [min, max] = s.volatility;
    const pct = min + Math.random() * (max - min);
    const direction = Math.random() < 0.5 ? 1 : -1;
    const change = pct * direction;
    const current = prices[s.ticker].price;
    const newPrice = Math.max(1, Math.round(current * (1 + change)));
    prices[s.ticker] = {
      price: newPrice,
      lastChange: change,
    };
  }
  savePrices(prices);
  return prices;
}

module.exports = { STOCK_DEFS, getPrices, savePrices, getPortfolios, savePortfolios, updatePrices };
