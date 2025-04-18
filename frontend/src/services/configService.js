// frontend/src/services/configService.js - Updated with USDT payment and reward configurations
import api from '../utils/api';
import logger from '../utils/logger';

// Configuration cache with default fallback values
let configCache = {
  POLYGON_AMOY_RPC_URL: process.env.REACT_APP_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/',
  POLYGON_AMOY_CHAIN_ID: 80002,
  FACTORY_ADDRESS: process.env.REACT_APP_FACTORY_ADDRESS || '',
  SMART_WALLET_FACTORY_ADDRESS: process.env.REACT_APP_SMART_WALLET_FACTORY_ADDRESS || '',
  USDT_ADDRESS: process.env.REACT_APP_USDT_ADDRESS || '',
  ENABLE_REWARDS: true,
  // Default values for new configurations (will be overwritten by server values when available)
  PLATFORM_FEE_PERCENT: 6,
  ESTIMATED_TX_COST: 0.001,
  MIN_REWARD_AMOUNT: 0.01,
  MAX_REWARD_AMOUNT: 10,
  REWARDS_SAFETY_BUFFER: 1.05
};

// Last time configuration was fetched
let lastFetchTime = 0;
// Refresh interval in milliseconds (e.g., 5 minutes)
const REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Fetch configuration from the server
 * @param {boolean} force - Force refresh even if cache is recent
 * @returns {Promise<Object>} Configuration object
 */
const fetchConfig = async (force = false) => {
  try {
    const now = Date.now();
    
    // Only fetch if forced or cache is older than refresh interval
    if (force || now - lastFetchTime > REFRESH_INTERVAL) {
      logger.info('Fetching configuration from server...');
      
      const response = await api.get('/config');
      
      if (response.data.success) {
        // Update cache with server values
        configCache = {
          ...configCache, // Keep fallback values
          ...response.data.data // Override with server values
        };
        
        // Update fetch time
        lastFetchTime = now;
        
        logger.info('Configuration refreshed successfully');
      } else {
        logger.warn('Failed to fetch configuration:', response.data.error);
      }
    } else {
      logger.debug('Using cached configuration');
    }
    
    return { ...configCache }; // Return a copy of the cache
  } catch (error) {
    logger.error('Error fetching configuration:', error);
    return { ...configCache }; // Return existing cache on error
  }
};

/**
 * Get a configuration value
 * @param {string} key - Configuration key
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} Configuration value
 */
const getConfig = async (key, defaultValue = null) => {
  await fetchConfig(); // Refresh if needed
  return configCache[key] !== undefined ? configCache[key] : defaultValue;
};

/**
 * Get all configuration values
 * @returns {Object} All configuration values
 */
const getAllConfig = async () => {
  await fetchConfig(); // Refresh if needed
  return { ...configCache };
};

/**
 * Get a configuration value synchronously (uses cache only)
 * @param {string} key - Configuration key
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} Configuration value
 */
const getConfigSync = (key, defaultValue = null) => {
  return configCache[key] !== undefined ? configCache[key] : defaultValue;
};

/**
 * Force refresh configuration
 * @returns {Promise<Object>} Updated configuration object
 */
const refreshConfig = async () => {
  return await fetchConfig(true);
};

/**
 * Calculate platform fee for a given amount
 * @param {number} amount - Amount to calculate fee for
 * @returns {number} Fee amount
 */
const calculatePlatformFee = (amount) => {
  const feePercent = getConfigSync('PLATFORM_FEE_PERCENT', 6);
  return (amount * feePercent) / 100;
};

/**
 * Calculate the estimated gas cost for poll creation and voting
 * @param {number} votesCount - Expected number of votes
 * @returns {number} Estimated cost in MATIC
 */
const calculateTransactionCost = (votesCount) => {
  const baseTxCost = getConfigSync('ESTIMATED_TX_COST', 0.001);
  const safetyBuffer = getConfigSync('REWARDS_SAFETY_BUFFER', 1.05);
  
  // Estimate 2 transactions per voter (approve + vote)
  return (baseTxCost * 2 * votesCount) * safetyBuffer;
};

/**
 * Validate a reward amount against min/max settings
 * @param {number} amount - Reward amount to validate
 * @returns {Object} Validation result with isValid and message
 */
const validateRewardAmount = (amount) => {
  const minReward = getConfigSync('MIN_REWARD_AMOUNT', 0.01);
  const maxReward = getConfigSync('MAX_REWARD_AMOUNT', 10);
  
  if (amount < minReward) {
    return { 
      isValid: false, 
      message: `Reward must be at least ${minReward} USDT per voter` 
    };
  }
  
  if (amount > maxReward) {
    return { 
      isValid: false, 
      message: `Reward cannot exceed ${maxReward} USDT per voter` 
    };
  }
  
  return { isValid: true };
};

// Export the service methods
const configService = {
  getConfig,
  getAllConfig,
  getConfigSync,
  refreshConfig,
  calculatePlatformFee,
  calculateTransactionCost,
  validateRewardAmount
};

export default configService;