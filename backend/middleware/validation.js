// backend/middleware/validation.js
const { ValidationError } = require('../utils/errorTypes');

/**
 * Middleware generator for request validation
 * @param {Object} schema - Joi validation schema
 * @param {String} property - Request property to validate (body, query, params)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false });
    
    if (!error) {
      // Validation passed, update with sanitized values
      req[property] = value;
      return next();
    }
    
    // Format validation errors
    const validationErrors = {};
    
    error.details.forEach(detail => {
      const key = detail.path.join('.');
      validationErrors[key] = detail.message;
    });
    
    // Throw validation error
    throw new ValidationError('Validation failed', validationErrors);
  };
};

module.exports = {
  validate
};