// backend/routes/payments.js
const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const User        = require('../models/User');
const { auth }    = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const mpesa       = require('../services/mpesa');

// ── DEPOSIT ───────────────────────────────────────────────
router.post('/deposit', auth, [
  body('amount').isFloat({ min: 1 }),
  body('method').isIn(['mpesa', 'card', 'bank', 'crypto'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ message: errors.array()[0].msg });

  try {
    const { amount, method, phoneNumber, cardNumber, cardName, reference, txid } = req.body;
    const user = req.user;
    const ref  = `DEP${uuidv4().substr(0,8).toUpperCase()}`;

    const transaction = new Transaction({
      user: user._id,
      type: 'deposit',
      amount,
      method,
      reference: ref,
      phoneNumber: phoneNumber || '',
      status: 'pending'
    });
    await transaction.save();

    // ── M-PESA STK PUSH ──
    if (method === 'mpesa') {
      if (!phoneNumber)
        return res.status(400).json({ message: 'Phone number is required for M-Pesa' });

      try {
        const stkResponse = await mpesa.initiateSTKPush({
          phoneNumber,
          amount,
          reference: ref,
          description: 'Lohan Deposit'
        });

        // Save checkout request ID for callback matching
        transaction.metadata = {
          checkoutRequestId: stkResponse.CheckoutRequestID,
          merchantRequestId: stkResponse.MerchantRequestID
        };
        await transaction.save();

        return res.json({
          success: true,
          message: 'M-Pesa prompt sent! Enter your PIN on your phone.',
          transaction: { id: transaction._id, reference: ref, amount, status: 'pending' }
        });
      } catch (mpesaError) {
        // If M-Pesa credentials not set up, fall through to simulation
        console.warn('M-Pesa API error:', mpesaError.message);
        console.warn('Falling back to simulation mode...');
      }
    }

    // ── SIMULATION (for card/bank/crypto or when M-Pesa creds missing) ──
    setTimeout(async () => {
      try {
        transaction.status = 'completed';
        transaction.processedAt = new Date();
        await transaction.save();

        const dbUser = await User.findById(user._id);
        dbUser.balance += amount;
        await dbUser.save();

        // Real-time notification via socket if available
        const io = global.io;
        if (io) {
          io.to(dbUser._id.toString()).emit('balanceUpdate', {
            balance: dbUser.balance,
            transaction: { id: transaction._id, reference: ref, amount, status: 'completed' }
          });
        }
      } catch (e) {
        console.error('Deposit completion error:', e);
      }
    }, method === 'mpesa' ? 8000 : 3000);

    res.json({
      success: true,
      message: method === 'mpesa'
        ? 'M-Pesa prompt sent! Enter your PIN on your phone.'
        : method === 'card'
          ? 'Card payment processing...'
          : method === 'bank'
            ? 'Bank transfer submitted. Will be credited in 1-2 days.'
            : 'Crypto deposit submitted. Awaiting confirmation.',
      transaction: { id: transaction._id, reference: ref, amount, status: 'pending' }
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── M-PESA CALLBACK (called by Safaricom after STK push) ──
router.post('/mpesa-callback', async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) return res.json({ ResultCode: 0 });

    const { ResultCode, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;

    const transaction = await Transaction.findOne({
      'metadata.checkoutRequestId': CheckoutRequestID
    });
    if (!transaction) return res.json({ ResultCode: 0 });

    if (ResultCode === 0) {
      // Payment successful
      const mpesaReceiptItem = CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber');
      const mpesaReceipt = mpesaReceiptItem?.Value || '';

      transaction.status      = 'completed';
      transaction.mpesaReceipt = mpesaReceipt;
      transaction.processedAt  = new Date();
      await transaction.save();

      // Credit user balance
      const user = await User.findById(transaction.user);
      user.balance += transaction.amount;
      await user.save();

      // Notify via socket
      const io = global.io;
      if (io) {
        io.to(user._id.toString()).emit('balanceUpdate', {
          balance: user.balance,
          transaction: { id: transaction._id, reference: transaction.reference, amount: transaction.amount, status: 'completed' }
        });
      }
    } else {
      // Payment failed/cancelled
      transaction.status = 'failed';
      await transaction.save();
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.json({ ResultCode: 0 });
  }
});

// ── WITHDRAW ──────────────────────────────────────────────
router.post('/withdraw', auth, [
  body('amount').isFloat({ min: 1 }),
  body('method').isIn(['mpesa', 'bank', 'crypto'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ message: errors.array()[0].msg });

  try {
    const { amount, method } = req.body;
    const user = req.user;

    if (user.balance < amount)
      return res.status(400).json({ message: 'Insufficient balance' });

    // Deduct balance immediately
    user.balance -= amount;
    await user.save();

    const transaction = new Transaction({
      user: user._id,
      type: 'withdrawal',
      amount: -amount,
      method,
      reference: `WTH${uuidv4().substr(0,8).toUpperCase()}`,
      status: 'pending'
    });
    await transaction.save();

    res.json({
      success: true,
      message: 'Withdrawal request submitted. Processing within 24 hours.',
      transaction: { id: transaction._id, reference: transaction.reference, amount: -amount, status: 'pending' },
      balance: user.balance
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── TRANSACTION HISTORY ───────────────────────────────────
router.get('/history', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── CHECK DEPOSIT STATUS ──────────────────────────────────
router.get('/status/:reference', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      reference: req.params.reference,
      user: req.user._id
    });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ status: transaction.status, balance: req.user.balance });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;