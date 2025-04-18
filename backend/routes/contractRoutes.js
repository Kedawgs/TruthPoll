// backend/routes/contractRoutes.js
const express = require('express');
const contractController = require('../controllers/contractController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

// Public routes
router.route('/polls')
  .get(contractController.getAllPolls);

router.route('/polls/:address')
  .get(contractController.getPollDetails);

router.route('/polls/creator/:address')
  .get(contractController.getPollsByCreator);

// USDT approval route
router.route('/approve-usdt')
  .post(isAuthenticated, contractController.approveUSDT);

// Admin-only routes
// Only accessible in non-production environments AND requires admin authentication
if (process.env.NODE_ENV !== 'production') {
  router.route('/deploy-factory')
    .post(isAuthenticated, isAdmin, contractController.deployFactory);
}

module.exports = router;