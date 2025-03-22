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
      
      res.status(200).json({
        success: true,
        data: {
          issuer: metadata.issuer,
          email: metadata.email,
          publicAddress: metadata.publicAddress
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