// backend/routes/trades.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Trade = require('../models/Trade');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const priceFeed = require('../services/priceFeed');

// @route   POST /api/trades
// @desc    Place a new trade (real or demo)
router.post('/', auth, [
  body('asset').notEmpty(),
  body('direction').isIn(['call', 'put', 'even', 'odd', 'over', 'under', 'match', 'differ']),
  body('amount').isFloat({ min: 1 }),
  body('duration').isIn([30, 60, 300, 900]),
  body('isDemo').optional().isBoolean(),
  body('digitPrediction').optional().isInt({ min: 0, max: 9 }) // for match/differ
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { asset, direction, amount, duration, isDemo = false, digitPrediction } = req.body;
    const user = req.user;

    // Get current price
    const currentPrice = priceFeed.getPrice(asset);
    if (!currentPrice) {
      return res.status(400).json({ message: 'Asset not available' });
    }

    if (isDemo) {
      // ── DEMO MODE ──
      const expiryTime = new Date(Date.now() + duration * 1000);
      const trade = new Trade({
        user: user._id,
        asset,
        assetType: priceFeed.getAssetType(asset),
        direction,
        amount,
        entryPrice: currentPrice,
        expiryTime,
        duration,
        digitPrediction: digitPrediction ?? null,
        isDemo: true,
        payoutRate: 1.0,
      });
      await trade.save();

      setTimeout(async () => {
        await resolveTrade(trade._id, true);
      }, duration * 1000);

      return res.status(201).json({
        success: true,
        isDemo: true,
        trade: {
          id: trade._id,
          asset: trade.asset,
          direction: trade.direction,
          amount: trade.amount,
          entryPrice: trade.entryPrice,
          expiryTime: trade.expiryTime,
          remainingTime: duration
        }
      });
    }

    // ── REAL MODE ──
    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.balance -= amount;
    await user.save();

    const expiryTime = new Date(Date.now() + duration * 1000);
    const trade = new Trade({
      user: user._id,
      asset,
      assetType: priceFeed.getAssetType(asset),
      direction,
      amount,
      entryPrice: currentPrice,
      expiryTime,
      duration,
      payoutRate: 1.0,
      digitPrediction: digitPrediction ?? null,
      isDemo: false
    });

    await trade.save();

    setTimeout(async () => {
      await resolveTrade(trade._id, false);
    }, duration * 1000);

    res.status(201).json({
      success: true,
      isDemo: false,
      trade: {
        id: trade._id,
        asset: trade.asset,
        direction: trade.direction,
        amount: trade.amount,
        entryPrice: trade.entryPrice,
        expiryTime: trade.expiryTime,
        remainingTime: duration
      },
      balance: user.balance
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/trades/active
router.get('/active', auth, async (req, res) => {
  try {
    const isDemo = req.query.demo === 'true';
    const trades = await Trade.find({
      user: req.user._id,
      status: 'active',
      isDemo
    }).sort({ createdAt: -1 });

    const now = new Date();
    const tradesWithTime = trades.map(trade => ({
      ...trade.toObject(),
      remainingTime: Math.max(0, Math.ceil((trade.expiryTime - now) / 1000))
    }));

    res.json(tradesWithTime);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/trades/history
router.get('/history', auth, async (req, res) => {
  try {
    const isDemo = req.query.demo === 'true';
    const trades = await Trade.find({
      user: req.user._id,
      status: { $in: ['won', 'lost', 'cancelled'] },
      isDemo
    })
    .sort({ createdAt: -1 })
    .limit(50);

    res.json(trades);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── RESOLVE TRADE ──
async function resolveTrade(tradeId, isDemo) {
  try {
    const trade = await Trade.findById(tradeId).populate('user');
    if (!trade || trade.status !== 'active') return;

    const exitPrice = priceFeed.getPrice(trade.asset);
    const lastDigit = Math.round(exitPrice * 10) % 10;

    // Determine win based on contract type
    let won = false;
    switch (trade.direction) {
      case 'call':
        won = exitPrice > trade.entryPrice;
        break;
      case 'put':
        won = exitPrice < trade.entryPrice;
        break;
      case 'even':
        won = lastDigit % 2 === 0;
        break;
      case 'odd':
        won = lastDigit % 2 !== 0;
        break;
      case 'over':
        won = lastDigit > 5;
        break;
      case 'under':
        won = lastDigit < 5;
        break;
      case 'match':
        won = lastDigit === trade.digitPrediction;
        break;
      case 'differ':
        won = lastDigit !== trade.digitPrediction;
        break;
      default:
        won = exitPrice > trade.entryPrice;
    }

    trade.exitPrice = exitPrice;
    trade.status    = won ? 'won' : 'lost';
    trade.profit    = won ? trade.amount * trade.payoutRate : -trade.amount;
    trade.closedAt  = new Date();
    await trade.save();

    const user = trade.user;

    if (isDemo) {
      const io = global.io;
      if (io) {
        io.to(user._id.toString()).emit('demoTradeResolved', {
          tradeId: trade._id,
          result: trade.status,
          profit: trade.profit,
          won
        });
      }
      return;
    }

    // Real — update balance and stats
    if (won) {
      user.balance += trade.amount * (1 + trade.payoutRate);
      user.stats.winCount    += 1;
      user.stats.totalProfit += trade.amount * trade.payoutRate;
    } else {
      user.stats.lossCount += 1;
      user.stats.totalLoss += trade.amount;
    }
    user.stats.totalTrades += 1;
    await user.save();

    const io = global.io;
    if (io) {
      io.to(user._id.toString()).emit('tradeResolved', {
        tradeId: trade._id,
        result: trade.status,
        profit: trade.profit,
        balance: user.balance
      });
    }
  } catch (error) {
    console.error('Trade resolution error:', error);
  }
}

module.exports = router;