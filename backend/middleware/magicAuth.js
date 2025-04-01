// backend/middleware/magicAuth.js
const magic = require('../config/magic');

/**
 * Middleware to verify Magic.link authentication
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware function
 */
const magicAuth = async (req, res, next) => {
  try {
    // Get DID token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // If no token is provided, continue without verification
      // This allows both Magic and non-Magic authentication flows
      return next();
    }
    
    const didToken = authHeader.substring(7);
    
    // Check if this looks like a Magic token (basic heuristic)
    const isMagicToken = didToken.includes('.magic.');
    
    if (!isMagicToken) {
      // Not a Magic token, continue to next middleware
      return next();
    }
    
    // Validate the token
    try {
      magic.token.validate(didToken);
      
      // Get user metadata
      const metadata = await magic.users.getMetadataByToken(didToken);
      
      // Get admin addresses from environment
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
      const isAdmin = adminAddresses.includes(metadata.publicAddress.toLowerCase());
      
      // Attach user info to the request
      req.user = {
        issuer: metadata.issuer,
        email: metadata.email,
        publicAddress: metadata.publicAddress,
        isMagicUser: true,
        isAdmin: isAdmin  // Add admin status flag
      };
      
    } catch (error) {
      console.error('Invalid Magic DID token:', error);
      // Do not block the request if token is invalid
      // Just don't attach the user object
    }
    
    next();
  } catch (error) {
    console.error('Error in Magic auth middleware:', error);
    next();
  }
};

module.exports = magicAuth;