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
    getReceivedRewards,
    getUserNonce,
    searchPolls
} = require('../controllers/pollController');

// Poll routes with validation
router.route('/')
    .get(getPolls)
    .post(isAuthenticated, verifyMagicAddress('creator'), validate(createPollSchema), createPoll); // createPoll is protected

router.route('/search')
    .get(validate(searchPollSchema, 'query'), searchPolls); // search is public

router.route('/:id')
    .get(getPoll); // get single poll is public

router.route('/:id/vote')
    .post(isAuthenticated, validate(votePollSchema), votePoll); // *** UPDATED: Added isAuthenticated ***

router.route('/:id/end')
    .put(isAuthenticated, validate(endPollSchema), endPoll); // endPoll is protected

router.route('/:id/reactivate')
    .put(isAuthenticated, validate(reactivatePollSchema), reactivatePoll); // reactivatePoll is protected

// Public route, controller handles authorization checks if user is logged in
router.route('/received-rewards/:address')
    .get(getReceivedRewards);

// Public route, controller handles authorization checks if user is logged in
router.route('/nonce/:pollAddress/:userAddress')
    .get(getUserNonce);

module.exports = router;