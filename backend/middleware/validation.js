// backend/middleware/validation.js
const { ValidationError } = require('../utils/errorTypes');
const sanitizeHtml = require('sanitize-html'); // You'll need to install this package

/**
 * Middleware generator for request validation
 * @param {Object} schema - Joi validation schema
 * @param {String} property - Request property to validate (body, query, params)
 * @param {boolean} sanitize - Whether to sanitize HTML in string fields
 */
const validate = (schema, property = 'body', sanitize = true) => {
  return (req, res, next) => {
    try {
      // First sanitize HTML if enabled
      if (sanitize && req[property] && typeof req[property] === 'object') {
        sanitizeObject(req[property]);
      }

      // Then validate against schema
      const { error, value } = schema.validate(req[property], { 
        abortEarly: false,
        stripUnknown: true // Remove unknown fields
      });
      
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
      
      // Create validation error
      const validationError = new ValidationError('Validation failed', validationErrors);
      return next(validationError);
    } catch (err) {
      return next(err);
    }
  };
};

/**
 * Recursively sanitize HTML in all string fields of an object
 * @param {Object} obj - Object to sanitize
 */
function sanitizeObject(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        // Sanitize string values
        obj[key] = sanitizeHtml(value, {
          allowedTags: [], // No HTML tags allowed
          allowedAttributes: {}, // No HTML attributes allowed
          disallowedTagsMode: 'recursiveEscape' // Encode < and > characters
        });
      } else if (value && typeof value === 'object') {
        // Recursively sanitize nested objects and arrays
        sanitizeObject(value);
      }
    }
  }
}

module.exports = { validate };