// backend/routes/contractRoutes.js
const express = require('express');
const {
  deployFactory,
  getPollsByCreator,
  getAllPolls,
  getPollDetails
} = require('../controllers/contractController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

// Public routes
router.route('/polls')
  .get(getAllPolls);

router.route('/polls/:address')
  .get(getPollDetails);

router.route('/polls/creator/:address')
  .get(getPollsByCreator);

// Admin-only routes
// Only accessible in non-production environments AND requires admin authentication
if (process.env.NODE_ENV !== 'production') {
  router.route('/deploy-factory')
    .post(isAuthenticated, isAdmin, deployFactory);
}

module.exports = router;