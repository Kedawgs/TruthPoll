// backend/routes/smartWalletRoutes.js
const express = require('express');
const router = express.Router();
const { getWalletAddress, deployWallet, relayTransaction } = require('../controllers/smartWalletController');
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');
const { getWalletAddressSchema, deployWalletSchema, relayTransactionSchema } = require('../validations/walletValidation');

// Smart wallet routes with validation
router.route('/:address')
  .get(validate(getWalletAddressSchema, 'params'), getWalletAddress);

// Deploy wallet - conditionally require signature for non-magic users
router.route('/')
  .post(
    isAuthenticated, 
    verifyMagicAddress('userAddress'), 
    (req, res, next) => {
      // Set context flag for conditional validation
      req.validateContext = { 
        requireSignature: !req.user?.isMagicUser
      };
      next();
    },
    validate(deployWalletSchema),
    deployWallet
  );

// Add new route for relaying transactions
router.route('/relay-transaction')
  .post(
    isAuthenticated,
    validate(relayTransactionSchema),
    relayTransaction
  );

module.exports = router;