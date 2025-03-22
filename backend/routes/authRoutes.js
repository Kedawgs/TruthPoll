const express = require('express');
const { verifyToken } = require('../controllers/authController');

const router = express.Router();

// Auth routes
router.route('/verify')
  .post(verifyToken);

module.exports = router;