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

// Import model and services needed for test route
const Poll = require('../models/Poll');
const RelayerService = require('../services/relayerService');
const ethers = require('ethers');

// Create provider
const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);

// Initialize relayer service
const relayerService = new RelayerService(provider, process.env.PLATFORM_WALLET_PRIVATE_KEY);

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

// Add test vote route for direct platform wallet voting
router.route('/:id/test-vote')
  .post(async (req, res) => {
    try {
      console.log("====== TEST VOTE ENDPOINT ======");
      const { optionIndex } = req.body;
      
      if (optionIndex === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Please provide option index'
        });
      }
      
      const poll = await Poll.findById(req.params.id);
      
      if (!poll) {
        return res.status(404).json({
          success: false,
          error: 'Poll not found'
        });
      }
      
      if (!poll.contractAddress) {
        return res.status(400).json({
          success: false,
          error: 'Poll contract not deployed'
        });
      }
      
      // Use the direct vote method from the relayer service
      const result = await relayerService.directVote(
        poll.contractAddress,
        optionIndex
      );
      
      res.status(200).json({
        success: true,
        data: result,
        message: "Test vote submitted successfully with platform wallet - FOR DEBUGGING ONLY"
      });
    } catch (error) {
      console.error('Error in test vote:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Server Error'
      });
    }
  });

module.exports = router;