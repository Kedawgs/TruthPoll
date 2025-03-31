// backend/routes/userRoutes.js
const express = require('express');
const { setUsername, getUserProfile } = require('../controllers/userController');
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');

const router = express.Router();

// User routes
router.route('/username')
  .post(isAuthenticated, verifyMagicAddress('address'), setUsername);

router.route('/profile/:address')
  .get(getUserProfile);

module.exports = router;