// backend/validations/pollValidation.js
const Joi = require('joi');

const createPollSchema = Joi.object({
  title: Joi.string().required().trim().max(100)
    .messages({
      'string.empty': 'Title is required',
      'string.max': 'Title cannot be more than 100 characters'
    }),
  description: Joi.string().allow('').max(500)
    .messages({
      'string.max': 'Description cannot be more than 500 characters'
    }),
  options: Joi.array().items(Joi.string().required())
    .min(2).required()
    .messages({
      'array.min': 'Poll must have at least 2 options',
      'array.base': 'Options must be an array'
    }),
  creator: Joi.string().required().pattern(/^0x[a-fA-F0-9]{40}$/)
    .messages({
      'string.empty': 'Creator address is required',
      'string.pattern.base': 'Creator must be a valid Polygon address'
    }),
  duration: Joi.number().min(0).default(0),
  category: Joi.string().valid(
    'General', 'Politics', 'Technology', 'Sports', 'Entertainment', 'Other'
  ).default('General'),
  tags: Joi.array().items(Joi.string()).default([]),
  rewardPerVoter: Joi.number().min(0).default(0)
});

const votePollSchema = Joi.object({
  optionIndex: Joi.number().required().min(0)
    .messages({
      'number.base': 'Option index must be a number',
      'number.min': 'Option index must be a non-negative number',
      'any.required': 'Option index is required'
    }),
  voterAddress: Joi.string().required().pattern(/^0x[a-fA-F0-9]{40}$/)
    .messages({
      'string.empty': 'Voter address is required',
      'string.pattern.base': 'Voter must be a valid Ethereum address'
    }),
  signature: Joi.string().required()
    .messages({
      'string.empty': 'Signature is required'
    })
});

const claimRewardSchema = Joi.object({
    pollAddress: Joi.string().required().pattern(/^0x[a-fA-F0-9]{40}$/)
      .messages({
        'string.empty': 'Poll address is required',
        'string.pattern.base': 'Poll address must be a valid Ethereum address'
      }),
    signature: Joi.string().required()
      .messages({
        'string.empty': 'Signature is required'
      })
  });
  
  // Export it along with the other schemas
  module.exports = {
    createPollSchema,
    votePollSchema,
    claimRewardSchema
  };