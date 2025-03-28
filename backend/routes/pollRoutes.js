// backend/routes/pollRoutes.js
const express = require('express');
const router = express.Router();

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
  .post(createPoll);

router.route('/search')
  .get(searchPolls);

router.route('/:id')
  .get(getPoll);

router.route('/:id/vote')
  .post(votePoll);

router.route('/:id/end')
  .put(endPoll);

router.route('/:id/reactivate')
  .put(reactivatePoll);

router.route('/claim-reward')
  .post(claimReward);

router.route('/claimable-rewards/:address')
  .get(getClaimableRewards);

router.route('/nonce/:pollAddress/:userAddress')
  .get(getUserNonce);

module.exports = router;