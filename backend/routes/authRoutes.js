// backend/routes/authRoutes.js
const express = require('express');
const {
    verifyToken,
    checkAdminStatus,
    verifyWalletSignature // Import the new controller function
} = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// Auth routes

// Route for token-based verification (e.g., Magic DID Token)
// Consider renaming '/verify' to '/verify-token' for clarity if desired,
// but keeping it as '/verify' is also possible if verifyToken handles multiple types.
// For this example, let's keep it '/verify' assuming verifyToken ONLY handles tokens.
router.route('/verify')
    .post(verifyToken);

// *** NEW ROUTE for standard wallet signature verification ***
router.route('/verify-signature')
    .post(verifyWalletSignature); // Use the new controller

// Route to check if user is an admin (requires existing valid session token)
router.route('/check-admin')
    .get(isAuthenticated, checkAdminStatus);

// Public route to check if an address is admin (doesn't require login)
router.route('/is-address-admin/:address')
    .get((req, res, next) => { // Added next for consistency with error handling
        try {
            const { address } = req.params;
            if (!address) {
                 // Basic validation
                 return res.status(400).json({ success: false, error: 'Address parameter is required'});
            }
            const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
            const isAdmin = adminAddresses.includes(address.toLowerCase());

            res.status(200).json({
                success: true,
                data: { isAdmin }
            });
        } catch(error) {
             // Catch potential errors like issues with process.env
             next(error);
        }
    });

module.exports = router;