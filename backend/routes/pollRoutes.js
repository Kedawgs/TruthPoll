// backend/routes/pollRoutes.js
const express = require('express');
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

const router = express.Router();

// Poll routes
router.route('/')
  .post(createPoll)  // Create a new poll
  .get(getPolls);    // Get all polls

router.route('/search')
  .get(searchPolls); // Search polls

router.route('/:id')
  .get(getPoll);     // Get a specific poll

router.route('/:id/vote')
  .post(votePoll);   // Vote on a poll

router.route('/:id/end')
  .put(endPoll);     // End a poll

router.route('/:id/reactivate')
  .put(reactivatePoll); // Reactivate a poll

// New routes for rewards and nonce
router.route('/claim-reward')
  .post(claimReward);     // Claim reward for a poll

router.route('/claimable-rewards/:address')
  .get(getClaimableRewards); // Get all claimable rewards for a user

router.route('/nonce/:pollAddress/:userAddress')
  .get(getUserNonce);      // Get user's nonce for a poll

module.exports = router;