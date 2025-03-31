// backend/routes/pollRoutes.js
const express = require('express');
const router = express.Router();

// Import middlewares
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');

// Import the controller
const {
  createPoll,
  getPolls,
  getPoll,
  votePoll,
  endPoll,
  reactivatePoll,
  claimReward,
  getClaimableRewards,
  getUserNonce,
  searchPolls
} = require('../controllers/pollController');

// Basic routes
router.route('/')
  .get(getPolls)
  .post(isAuthenticated, verifyMagicAddress('creator'), createPoll);

router.route('/search')
  .get(searchPolls);

router.route('/:id')
  .get(getPoll);

router.route('/:id/vote')
  .post(votePoll);

router.route('/:id/end')
  .put(isAuthenticated, endPoll);

router.route('/:id/reactivate')
  .put(isAuthenticated, reactivatePoll);

router.route('/claim-reward')
  .post(claimReward);

router.route('/claimable-rewards/:address')
  .get(getClaimableRewards);

router.route('/nonce/:pollAddress/:userAddress')
  .get(getUserNonce);

module.exports = router;