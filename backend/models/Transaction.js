// backend/models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'bonus', 'refund'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'KES' },
  method: { type: String, enum: ['mpesa', 'card', 'bank', 'crypto', 'internal'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending' },
  reference: { type: String, unique: true },
  phoneNumber: { type: String },
  mpesaReceipt: { type: String },
  metadata: { type: Object },
  processedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);