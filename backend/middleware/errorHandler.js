/**
 * Global error handler middleware
 * @param {object} err - Error object
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware function
 */
const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    console.error(err.stack);
    
    // Set status code
    const statusCode = err.statusCode || 500;
    
    // Send error response
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Server Error',
      // Only include stack trace in development
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  };
  
  module.exports = errorHandler;