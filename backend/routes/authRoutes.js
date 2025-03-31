// backend/routes/authRoutes.js
const express = require('express');
const { verifyToken, checkAdminStatus } = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// Auth routes
router.route('/verify')
  .post(verifyToken);

// Route to check if user is an admin (authenticated)
router.route('/check-admin')
  .get(isAuthenticated, checkAdminStatus);

// Public route to check if an address is admin
router.route('/is-address-admin/:address')
  .get((req, res) => {
    const { address } = req.params;
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
    const isAdmin = adminAddresses.includes(address.toLowerCase());
    
    res.status(200).json({
      success: true,
      data: { isAdmin }
    });
  });

module.exports = router;