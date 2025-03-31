// backend/routes/pollRoutes.js
const express = require('express');
const router = express.Router();

// Import middlewares
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');

// Import validation schemas
const {
  createPollSchema,
  votePollSchema,
  claimRewardSchema,
  endPollSchema,
  reactivatePollSchema,
  searchPollSchema
} = require('../validations/pollValidation');

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

// Poll routes with validation
router.route('/')
  .get(getPolls)
  .post(isAuthenticated, verifyMagicAddress('creator'), validate(createPollSchema), createPoll);

router.route('/search')
  .get(validate(searchPollSchema, 'query'), searchPolls);

router.route('/:id')
  .get(getPoll);

router.route('/:id/vote')
  .post(validate(votePollSchema), votePoll);

router.route('/:id/end')
  .put(isAuthenticated, validate(endPollSchema), endPoll);

router.route('/:id/reactivate')
  .put(isAuthenticated, validate(reactivatePollSchema), reactivatePoll);

router.route('/claim-reward')
  .post(validate(claimRewardSchema), claimReward);

router.route('/claimable-rewards/:address')
  .get(getClaimableRewards);

router.route('/nonce/:pollAddress/:userAddress')
  .get(getUserNonce);

module.exports = router;