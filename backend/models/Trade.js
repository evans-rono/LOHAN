// backend/models/Trade.js
const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  asset: { type: String, required: true },
  assetType: { type: String, enum: ['crypto', 'forex', 'commodity', 'stock', 'synthetic'], required: true },
  direction: { type: String, enum: ['call', 'put', 'even', 'odd', 'over', 'under', 'match', 'differ'], required: true },
  amount: { type: Number, required: true, min: 1 },
  digitPrediction: { type: Number, min: 0, max: 9, default: null }, // for match/differ contracts
  entryPrice: { type: Number, required: true },
  exitPrice: { type: Number },
  expiryTime: { type: Date, required: true },
  duration: { type: Number, required: true }, // in seconds
  payoutRate: { type: Number, default: 0.85 },
  status: { type: String, enum: ['active', 'won', 'lost', 'cancelled'], default: 'active' },
  profit: { type: Number, default: 0 },
  isDemo: { type: Boolean, default: false }, // ← demo flag
  closedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Trade', tradeSchema);