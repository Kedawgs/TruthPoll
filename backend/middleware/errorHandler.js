// backend/middleware/errorHandler.js
const { AppError } = require('../utils/errorTypes');
const logger = require('../utils/logger'); // We'll create this next

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  // Operational errors (expected)
  if (err instanceof AppError) {
    const response = {
      success: false,
      error: err.message
    };
    
    // Add validation errors if present
    if (err.validationErrors) {
      response.validationErrors = err.validationErrors;
    }
    
    // Add error code if present
    if (err.errorCode) {
      response.errorCode = err.errorCode;
    }
    
    return res.status(err.statusCode).json(response);
  }
  
  // For Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = {};
    
    Object.keys(err.errors).forEach(key => {
      errors[key] = err.errors[key].message;
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      validationErrors: errors
    });
  }
  
  // Mongoose CastError (e.g., invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: `Invalid ${err.path}: ${err.value}`
    });
  }
  
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      error: `${field} already exists`
    });
  }
  
  // Default to 500 server error
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;