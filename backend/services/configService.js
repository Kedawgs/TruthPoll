// backend/services/configService.js
const Config = require('../models/Config');
const logger = require('../utils/logger');

class ConfigService {
  constructor() {
    // Initialize cache for config values
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  }
  
  // Cache helpers
  _getCachedValue(key) {
    if (this.cache.has(key) && this.cacheExpiry.get(key) > Date.now()) {
      logger.debug(`Config cache hit for ${key}`);
      return this.cache.get(key);
    }
    return null;
  }
  
  _setCachedValue(key, value) {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.cacheTTL);
    logger.debug(`Config cached: ${key}`);
  }
  
  // Clear the entire cache or a specific key
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      logger.debug(`Config cache cleared for: ${key}`);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
      logger.debug('All config cache cleared');
    }
  }
  // Get a single configuration value with caching
  async get(key) {
    try {
      // Check cache first
      const cachedValue = this._getCachedValue(key);
      if (cachedValue !== null) {
        return cachedValue;
      }
      
      // If not in cache, fetch from database
      const config = await Config.findOne({ key });
      const value = config ? config.value : null;
      
      // Cache the result (even null values are cached to prevent repeated DB lookups)
      this._setCachedValue(key, value);
      
      return value;
    } catch (error) {
      logger.error(`Error getting config ${key}:`, error);
      throw error;
    }
  }

  // Alias getConfig to get for backward compatibility
  async getConfig(key, defaultValue = null) {
    const value = await this.get(key);
    return value !== null ? value : defaultValue;
  }

  // Get multiple configuration values with caching
  async getMultiple(keys, publicOnly = false) {
    try {
      // Cache key for this specific set of parameters
      const cacheKey = `multi_${publicOnly ? 'public_' : ''}${keys.sort().join('_')}`;
      
      // Check cache first
      const cachedValue = this._getCachedValue(cacheKey);
      if (cachedValue !== null) {
        return cachedValue;
      }
      
      const query = { key: { $in: keys } };
      if (publicOnly) {
        query.isPublic = true;
      }
      
      const configs = await Config.find(query);
      
      // Convert to key-value object
      const result = configs.reduce((result, config) => {
        result[config.key] = config.value;
        return result;
      }, {});
      
      // Cache the result
      this._setCachedValue(cacheKey, result);
      
      return result;
    } catch (error) {
      logger.error(`Error getting multiple configs:`, error);
      throw error;
    }
  }

  // Get all public configurations with caching
  async getAllPublic() {
    try {
      const cacheKey = 'all_public_configs';
      
      // Check cache first
      const cachedValue = this._getCachedValue(cacheKey);
      if (cachedValue !== null) {
        return cachedValue;
      }
      
      const configs = await Config.find({ isPublic: true });
      
      // Convert to key-value object
      const result = configs.reduce((result, config) => {
        result[config.key] = config.value;
        return result;
      }, {});
      
      // Cache the result
      this._setCachedValue(cacheKey, result);
      
      return result;
    } catch (error) {
      logger.error(`Error getting all public configs:`, error);
      throw error;
    }
  }

  // Set a configuration value and clear cache
  async set(key, value, isPublic = true, description = '') {
    try {
      const result = await Config.findOneAndUpdate(
        { key },
        { 
          value, 
          isPublic, 
          description,
          updatedAt: new Date()
        },
        { 
          new: true, 
          upsert: true 
        }
      );
      
      // Clear specific key cache and any cache that might contain this key
      this.clearCache(key);
      this.clearCache('all_public_configs');
      
      // Clear any multi-key caches that might include this key
      for (const cacheKey of this.cache.keys()) {
        if (cacheKey.startsWith('multi_') && cacheKey.includes(key)) {
          this.clearCache(cacheKey);
        }
      }
      
      logger.info(`Config ${key} updated`);
      return result;
    } catch (error) {
      logger.error(`Error setting config ${key}:`, error);
      throw error;
    }
  }

  // Initialize default configuration values if not present
  async initializeDefaults() {
    try {
      // Check if transaction cost estimate exists
      const existingTxCost = await this.get('ESTIMATED_TX_COST');
      if (existingTxCost === null) {
        // Set default transaction cost estimate (in MATIC)
        await this.set(
          'ESTIMATED_TX_COST',
          0.001, // Default cost in MATIC
          true,  // Public
          'Estimated transaction cost for poll operations on Polygon Amoy (in MATIC)'
        );
        logger.info('Initialized default transaction cost estimate configuration');
      }
      
      // Check if platform fee percentage exists
      const existingPlatformFee = await this.get('PLATFORM_FEE_PERCENT');
      if (existingPlatformFee === null) {
        // Set default platform fee percentage
        await this.set(
          'PLATFORM_FEE_PERCENT',
          6, // 6% platform fee
          true,
          'Platform fee percentage applied to poll rewards'
        );
        logger.info('Initialized default platform fee percentage configuration');
      }
      
      // Check if the minimum reward amount exists
      const existingMinReward = await this.get('MIN_REWARD_AMOUNT');
      if (existingMinReward === null) {
        await this.set(
          'MIN_REWARD_AMOUNT',
          0.01, // Minimum 0.01 USDT per voter
          true,
          'Minimum reward amount per voter (in USDT)'
        );
        logger.info('Initialized minimum reward amount configuration');
      }
      
      // Check if the maximum reward amount exists
      const existingMaxReward = await this.get('MAX_REWARD_AMOUNT');
      if (existingMaxReward === null) {
        await this.set(
          'MAX_REWARD_AMOUNT',
          10, // Maximum 10 USDT per voter
          true,
          'Maximum reward amount per voter (in USDT)'
        );
        logger.info('Initialized maximum reward amount configuration');
      }
      
      // Check if USDT approval gas limit exists
      const existingApprovalGas = await this.get('USDT_APPROVAL_GAS_LIMIT');
      if (existingApprovalGas === null) {
        await this.set(
          'USDT_APPROVAL_GAS_LIMIT',
          100000, // 100,000 gas
          false,  // Private config
          'Gas limit for USDT approval transactions'
        );
        logger.info('Initialized USDT approval gas limit configuration');
      }
      
      // Check if poll creation gas limit exists
      const existingPollCreationGas = await this.get('POLL_CREATION_GAS_LIMIT');
      if (existingPollCreationGas === null) {
        await this.set(
          'POLL_CREATION_GAS_LIMIT',
          3000000, // 3,000,000 gas
          false,   // Private config
          'Gas limit for poll creation transactions'
        );
        logger.info('Initialized poll creation gas limit configuration');
      }

      // Check if rewards safety buffer exists
      const existingRewardBuffer = await this.get('REWARDS_SAFETY_BUFFER');
      if (existingRewardBuffer === null) {
        await this.set(
          'REWARDS_SAFETY_BUFFER',
          1.05, // 5% extra for safety
          false, // Private config
          'Safety buffer multiplier for reward calculations (e.g., 1.05 = 5% extra)'
        );
        logger.info('Initialized rewards safety buffer configuration');
      }
      
      return true;
    } catch (error) {
      logger.error('Error initializing default configurations:', error);
      return false;
    }
  }
}

// Export an instance of the class instead of the class itself
module.exports = new ConfigService();