// backend/middleware/authMiddleware.js
const { AuthenticationError } = require('../utils/errorTypes');

/**
 * Middleware to check if user is authenticated
 */
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  next();
};

module.exports = {
  isAuthenticated
};