// backend/middleware/authMiddleware.js
const { AuthenticationError, AuthorizationError } = require('../utils/errorTypes');
const logger = require('../utils/logger');

/**
 * Middleware to check if user is authenticated
 */
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  next();
};

/**
 * Middleware to verify Magic user address matches request address
 * @param {string} addressField - The name of the field containing the address to check
 */
const verifyMagicAddress = (addressField) => {
  return (req, res, next) => {
    // Only apply for Magic authenticated users
    if (req.user && req.user.isMagicUser) {
      const addressToVerify = req.body[addressField];
      
      if (!addressToVerify) {
        return next(new ValidationError(`${addressField} is required`));
      }
      
      if (addressToVerify.toLowerCase() !== req.user.publicAddress.toLowerCase()) {
        logger.warn(`Address mismatch: ${addressToVerify} vs ${req.user.publicAddress}`);
        return next(new AuthorizationError(`Not authorized to act as ${addressField}: ${addressToVerify}`));
      }
    }
    next();
  };
};

module.exports = {
  isAuthenticated,
  verifyMagicAddress
};