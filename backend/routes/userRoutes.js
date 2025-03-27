// backend/routes/userRoutes.js
const express = require('express');
const { setUsername, getUserProfile } = require('../controllers/userController');

const router = express.Router();

// User routes
router.route('/username')
  .post(setUsername);

router.route('/profile/:address')
  .get(getUserProfile);

module.exports = router;