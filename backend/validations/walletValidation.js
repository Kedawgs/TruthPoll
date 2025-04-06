// backend/validations/walletValidation.js
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

// Get wallet address schema
const getWalletAddressSchema = Joi.object({
  address: ethereumAddress.required().messages({
    'any.required': 'Address is required'
  })
});

// Deploy wallet schema
const deployWalletSchema = Joi.object({
  userAddress: ethereumAddress.required().messages({
    'any.required': 'User address is required'
  }),
  signature: Joi.string()
    .when('$requireSignature', {
      is: true,
      then: Joi.string().required().pattern(/^0x[a-fA-F0-9]{130}$/).messages({
        'string.empty': 'Signature is required',
        'string.pattern.base': 'Invalid signature format'
      }),
      otherwise: Joi.string().optional()
    })
});

// New schema for relay transaction
const relayTransactionSchema = Joi.object({
  smartWalletAddress: ethereumAddress.required().messages({
    'any.required': 'Smart wallet address is required'
  }),
  targetAddress: ethereumAddress.required().messages({
    'any.required': 'Target contract address is required'
  }),
  callData: Joi.string()
    .required()
    .pattern(/^0x[a-fA-F0-9]+$/)
    .messages({
      'string.empty': 'Call data is required',
      'string.pattern.base': 'Invalid call data format'
    }),
  signature: Joi.string()
    .required()
    .pattern(/^0x[a-fA-F0-9]+$/)
    .messages({
      'string.empty': 'Signature is required',
      'string.pattern.base': 'Invalid signature format'
    }),
  value: Joi.string()
    .pattern(/^[0-9]+$/)
    .default('0')
    .messages({
      'string.pattern.base': 'Value must be a numeric string'
    })
});

module.exports = {
  getWalletAddressSchema,
  deployWalletSchema,
  relayTransactionSchema
};