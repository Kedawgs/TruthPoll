const express = require('express');
const {
  createWallet,
  fundWallet,
  getWallet,
  executeTransaction
} = require('../controllers/walletController');

const router = express.Router();

// Wallet routes
router.route('/')
  .post(createWallet);  // Create a proxy wallet

router.route('/fund')
  .post(fundWallet);    // Fund a proxy wallet

router.route('/execute')
  .post(executeTransaction); // Execute a transaction with a proxy wallet

router.route('/:address')
  .get(getWallet);      // Get wallet details

module.exports = router;