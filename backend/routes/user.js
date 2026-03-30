// backend/routes/user.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Trade = require('../models/Trade');

// @route   GET /api/user/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTrades = await Trade.find({
      user: user._id,
      closedAt: { $gte: today },
      status: { $in: ['won', 'lost'] }
    });

    const todayPnL = todayTrades.reduce((acc, t) => acc + t.profit, 0);

    res.json({
      balance: user.balance,
      stats: user.stats,
      todayPnL,
      todayTrades: todayTrades.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/user/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/user/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await User.findById(req.user.id);

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    await user.save();
    res.json({ success: true, user: { firstName: user.firstName, lastName: user.lastName, phone: user.phone } });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;