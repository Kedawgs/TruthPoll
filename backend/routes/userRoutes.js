// backend/routes/userRoutes.js
const express = require('express');
const { setUsername, getUserProfile } = require('../controllers/userController');
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');
const { usernameSchema, userProfileSchema } = require('../validations/userValidation');

const router = express.Router();

// User routes with validation
router.route('/username')
  .post(isAuthenticated, verifyMagicAddress('address'), validate(usernameSchema), setUsername);

router.route('/profile/:address')
  .get(validate(userProfileSchema, 'params'), getUserProfile);

module.exports = router;