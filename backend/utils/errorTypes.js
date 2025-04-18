// backend/utils/errorTypes.js
class AppError extends Error {
    constructor(message, statusCode, errorCode = null) {
      super(message);
      this.statusCode = statusCode;
      this.errorCode = errorCode;
      this.isOperational = true;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  class ValidationError extends AppError {
    constructor(message, validationErrors = {}) {
      super(message, 400);
      this.validationErrors = validationErrors;
    }
  }
  
  class NotFoundError extends AppError {
    constructor(resource) {
      super(`${resource} not found`, 404);
    }
  }
  
  class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
      super(message, 401);
    }
  }
  
  class AuthorizationError extends AppError {
    constructor(message = 'You are not authorized to perform this action') {
      super(message, 403);
    }
  }
  
  class BlockchainError extends AppError {
    constructor(message, originalError = null) {
      super(message, 500);
      this.originalError = originalError;
    }
  }
  
  module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    AuthenticationError,
    AuthorizationError,
    BlockchainError
  };