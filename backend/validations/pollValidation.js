// backend/validations/pollValidation.js
const Joi = require('joi');
const { ethers } = require('ethers');

// Custom validator for Ethereum addresses
const ethereumAddress = Joi.string()
  .custom((value, helpers) => {
    if (!ethers.utils.isAddress(value)) {
      return helpers.error('string.ethereumAddress');
    }
    return value.toLowerCase(); // Normalize to lowercase
  }, 'Ethereum address validation')
  .message('{{#label}} must be a valid Ethereum address');

// Poll creation schema
const createPollSchema = Joi.object({
  title: Joi.string()
    .required()
    .trim()
    .min(3)
    .max(100)
    .pattern(/^[^<>]*$/)
    .messages({
      'string.empty': 'Title is required',
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title cannot be more than 100 characters',
      'string.pattern.base': 'Title contains invalid characters'
    }),
  description: Joi.string()
    .allow('')
    .trim()
    .max(500)
    .pattern(/^[^<>]*$/)
    .messages({
      'string.max': 'Description cannot be more than 500 characters',
      'string.pattern.base': 'Description contains invalid characters'
    }),
  options: Joi.array()
    .items(Joi.string().trim().min(1).max(100).pattern(/^[^<>]*$/))
    .min(2)
    .required()
    .messages({
      'array.min': 'Poll must have at least 2 options',
      'array.base': 'Options must be an array',
      'string.min': 'Option cannot be empty',
      'string.max': 'Option cannot be more than 100 characters',
      'string.pattern.base': 'Option contains invalid characters'
    }),
  creator: ethereumAddress.required().messages({
    'any.required': 'Creator address is required'
  }),
  duration: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'Duration must be a number',
    'number.min': 'Duration cannot be negative'
  }),
  category: Joi.string().valid(
    'General', 'Politics', 'Technology', 'Sports', 'Entertainment', 'Other'
  ).default('General'),
  tags: Joi.array()
    .items(Joi.string().trim().min(1).max(20).pattern(/^[a-zA-Z0-9_-]*$/))
    .max(5)
    .default([])
    .messages({
      'array.max': 'Maximum of 5 tags allowed',
      'string.pattern.base': 'Tags may only contain letters, numbers, underscores and hyphens'
    }),
  rewardPerVoter: Joi.number().min(0).default(0).messages({
    'number.base': 'Reward per voter must be a number',
    'number.min': 'Reward per voter cannot be negative'
  })
});

// Vote poll schema
const votePollSchema = Joi.object({
  optionIndex: Joi.number()
    .required()
    .integer()
    .min(0)
    .messages({
      'number.base': 'Option index must be a number',
      'number.min': 'Option index must be a non-negative number',
      'any.required': 'Option index is required'
    }),
  voterAddress: ethereumAddress.required().messages({
    'any.required': 'Voter address is required'
  }),
  signature: Joi.string()
    .required()
    .pattern(/^0x[a-fA-F0-9]{130}$/)
    .messages({
      'string.empty': 'Signature is required',
      'string.pattern.base': 'Invalid signature format'
    })
});

// Claim reward schema
const claimRewardSchema = Joi.object({
  pollAddress: ethereumAddress.required().messages({
    'any.required': 'Poll address is required'
  }),
  signature: Joi.string()
    .required()
    .pattern(/^0x[a-fA-F0-9]{130}$/)
    .messages({
      'string.empty': 'Signature is required',
      'string.pattern.base': 'Invalid signature format'
    })
});

// End poll schema
const endPollSchema = Joi.object({
  // Empty schema - no inputs needed for this endpoint
});

// Reactivate poll schema
const reactivatePollSchema = Joi.object({
  duration: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'Duration must be a number',
    'number.min': 'Duration cannot be negative'
  })
});

// Poll search schema
const searchPollSchema = Joi.object({
  query: Joi.string().required().trim().min(1).max(50).messages({
    'string.empty': 'Search query is required',
    'string.min': 'Search query must be at least 1 character',
    'string.max': 'Search query cannot be more than 50 characters'
  })
});

// Export it along with the other schemas
module.exports = {
  createPollSchema,
  votePollSchema,
  claimRewardSchema,
  endPollSchema,
  reactivatePollSchema,
  searchPollSchema
};