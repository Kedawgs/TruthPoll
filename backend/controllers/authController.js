// backend/controllers/authController.js
const magic = require('../config/magic');

/**
 * @desc    Verify Magic.link token
 * @route   POST /api/auth/verify
 * @access  Public
 */
exports.verifyToken = async (req, res) => {
  try {
    const { didToken } = req.body;
    
    if (!didToken) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a DID token'
      });
    }
    
    // Validate the token
    try {
      magic.token.validate(didToken);
      
      // Get user metadata
      const metadata = await magic.users.getMetadataByToken(didToken);
      
      // Check if user is admin - using environment variable list
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
      const isAdmin = adminAddresses.includes(metadata.publicAddress.toLowerCase());
      
      res.status(200).json({
        success: true,
        data: {
          issuer: metadata.issuer,
          email: metadata.email,
          publicAddress: metadata.publicAddress,
          isAdmin: isAdmin  // Include admin status in response
        }
      });
    } catch (error) {
      console.error('Invalid DID token:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Check if user is an admin
 * @route   GET /api/auth/check-admin
 * @access  Private
 */
exports.checkAdminStatus = async (req, res) => {
  try {
    // Get admin addresses from environment
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
    
    // Check if the authenticated user is an admin
    const isAdmin = adminAddresses.includes(req.user.publicAddress.toLowerCase());
    
    res.status(200).json({
      success: true,
      data: {
        isAdmin
      }
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};