const express = require('express');
const router = express.Router();
const { getWalletAddress, deployWallet } = require('../controllers/smartWalletController');

// Get wallet address
router.route('/:address')
  .get(getWalletAddress);

// Deploy wallet
router.route('/')
  .post(deployWallet);

module.exports = router;