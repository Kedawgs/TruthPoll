// backend/middleware/validation.js
const { ValidationError } = require('../utils/errorTypes');
const sanitizeHtml = require('sanitize-html');
const logger = require('../utils/logger');

/**
 * Middleware generator for request validation
 * @param {Object} schema - Joi validation schema
 * @param {String} property - Request property to validate (body, query, params)
 * @param {boolean} sanitize - Whether to sanitize HTML in string fields
 */
const validate = (schema, property = 'body', sanitize = true) => {
  return (req, res, next) => {
    try {
      // Special handling for multipart/form-data with file uploads
      if (req.file && property === 'body') {
        logger.info('Detected file upload, validating non-file fields');
        
        // Create a clean copy of request body for validation
        const dataToValidate = { ...req[property] };
        
        // Perform validation against provided schema
        const { error, value } = schema.validate(dataToValidate, { 
          abortEarly: false,
          stripUnknown: true // Remove unknown fields
        });
        
        if (error) {
          // Handle validation errors the same way
          const validationErrors = {};
          error.details.forEach(detail => {
            const key = detail.path.join('.');
            validationErrors[key] = detail.message;
          });
          
          const validationError = new ValidationError('Validation failed', validationErrors);
          return next(validationError);
        }
        
        // Update the request body with validated values
        req[property] = { ...value };
        
        // No sanitization needed for file uploads as they're binary
        return next();
      }

      // Standard validation for non-file requests
      // First sanitize HTML if enabled
      if (sanitize && req[property] && typeof req[property] === 'object') {
        // Use safe sanitization that checks if hasOwnProperty exists first
        safeSanitizeObject(req[property]);
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
      logger.error('Validation middleware error:', err);
      return next(err);
    }
  };
};

/**
 * Safely check if an object has a property
 * Works with both standard objects and FormData
 */
function hasProperty(obj, prop) {
  // First check if hasOwnProperty exists as a method
  if (typeof obj.hasOwnProperty === 'function') {
    return obj.hasOwnProperty(prop);
  }
  
  // Fall back to checking with Object.prototype.hasOwnProperty
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Recursively sanitize HTML in all string fields of an object
 * Works with both standard objects and FormData
 * @param {Object} obj - Object to sanitize
 */
function safeSanitizeObject(obj) {
  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach(item => {
      if (item && typeof item === 'object') {
        safeSanitizeObject(item);
      } else if (typeof item === 'string') {
        // Sanitize string values in array
        const index = obj.indexOf(item);
        obj[index] = sanitizeHtml(item, {
          allowedTags: [], // No HTML tags allowed
          allowedAttributes: {}, // No HTML attributes allowed
          disallowedTagsMode: 'recursiveEscape' // Encode < and > characters
        });
      }
    });
    return;
  }
  
  // Use Object.keys for safety with all types of objects
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    
    if (typeof value === 'string') {
      // Sanitize string values
      obj[key] = sanitizeHtml(value, {
        allowedTags: [], // No HTML tags allowed
        allowedAttributes: {}, // No HTML attributes allowed
        disallowedTagsMode: 'recursiveEscape' // Encode < and > characters
      });
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      safeSanitizeObject(value);
    }
  });
}

module.exports = { validate };