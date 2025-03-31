// backend/middleware/adminMiddleware.js
const { AuthorizationError } = require('../utils/errorTypes');

/**
 * Middleware to check if user is an admin
 */
const isAdmin = (req, res, next) => {
  // First ensure the user is authenticated
  if (!req.user) {
    throw new AuthorizationError('Authentication required');
  }
  
  // Check if user is admin - this checks against admin addresses in environment variables
  const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
  
  if (adminAddresses.includes(req.user.publicAddress.toLowerCase())) {
    next();
  } else {
    throw new AuthorizationError('Admin access required');
  }
};

module.exports = {
  isAdmin
};