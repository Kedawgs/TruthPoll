// backend/routes/userRoutes.js
const express = require('express');
const { setUsername, getUserProfile, getUserVotes, getUserActivity } = require('../controllers/userController');
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');
const { usernameSchema, userProfileSchema } = require('../validations/userValidation');

const router = express.Router();

// User routes with validation
router.route('/username')
  .post(isAuthenticated, verifyMagicAddress('address'), validate(usernameSchema), setUsername);

router.route('/profile/:address')
  .get(validate(userProfileSchema, 'params'), getUserProfile);

router.route('/votes/:address')
  .get(validate(userProfileSchema, 'params'), getUserVotes);

router.route('/activity/:address')
  .get(validate(userProfileSchema, 'params'), getUserActivity);

module.exports = router;