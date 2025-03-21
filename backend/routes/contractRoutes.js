const express = require('express');
const {
  deployFactory,
  getPollsByCreator,
  getAllPolls,
  getPollDetails
} = require('../controllers/contractController');

const router = express.Router();

// Contract routes
router.route('/deploy-factory')
  .post(deployFactory);  // Deploy the factory contract

router.route('/polls')
  .get(getAllPolls);     // Get all polls from blockchain

router.route('/polls/:address')
  .get(getPollDetails);  // Get details of a specific poll

router.route('/polls/creator/:address')
  .get(getPollsByCreator); // Get all polls by a specific creator

module.exports = router;