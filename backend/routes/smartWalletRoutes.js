// backend/routes/smartWalletRoutes.js
const express = require('express');
const router = express.Router();
const { getWalletAddress, deployWallet } = require('../controllers/smartWalletController');
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');

// Get wallet address
router.route('/:address')
  .get(getWalletAddress);

// Deploy wallet
router.route('/')
  .post(isAuthenticated, verifyMagicAddress('userAddress'), deployWallet);

module.exports = router;