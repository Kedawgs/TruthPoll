// backend/routes/configRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getPublicConfig, 
  getAdminConfig, 
  updateConfig 
} = require('../controllers/configController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');

// Public routes
router.route('/')
  .get(getPublicConfig);

// Admin routes
router.route('/admin')
  .get(isAuthenticated, isAdmin, getAdminConfig);

router.route('/')
  .put(isAuthenticated, isAdmin, updateConfig);

module.exports = router;