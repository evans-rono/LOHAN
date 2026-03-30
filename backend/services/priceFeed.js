// backend/services/priceFeed.js

const prices = {
  'EUR/USD': 1.08450,
  'GBP/USD': 1.26780,
  'BTC/USD': 67450.00,
  'ETH/USD': 3520.00,
  'GOLD': 2345.50,
  'OIL': 82.30,
  'Volatility 75': 100.00
};

const assetTypes = {
  'EUR/USD': 'forex',
  'GBP/USD': 'forex',
  'BTC/USD': 'crypto',
  'ETH/USD': 'crypto',
  'GOLD': 'commodity',
  'OIL': 'commodity',
  'Volatility 75': 'synthetic'
};

// Simulate live price movements
setInterval(() => {
  for (const asset in prices) {
    const change = (Math.random() - 0.5) * 0.001;
    prices[asset] = parseFloat((prices[asset] * (1 + change)).toFixed(5));
  }
}, 1000);

module.exports = {
  getPrice(asset) {
    return prices[asset] || null;
  },

  getAllPrices() {
    return { ...prices };
  },

  getAssetType(asset) {
    return assetTypes[asset] || 'forex';
  }
};