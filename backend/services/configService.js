// backend/services/configService.js - Updated with transaction cost estimates
const Config = require('../models/Config');
const logger = require('../utils/logger');

class ConfigService {
  // Get a single configuration value
  async get(key) {
    try {
      const config = await Config.findOne({ key });
      return config ? config.value : null;
    } catch (error) {
      logger.error(`Error getting config ${key}:`, error);
      throw error;
    }
  }

  // Get multiple configuration values
  async getMultiple(keys, publicOnly = false) {
    try {
      const query = { key: { $in: keys } };
      if (publicOnly) {
        query.isPublic = true;
      }
      
      const configs = await Config.find(query);
      
      // Convert to key-value object
      return configs.reduce((result, config) => {
        result[config.key] = config.value;
        return result;
      }, {});
    } catch (error) {
      logger.error(`Error getting multiple configs:`, error);
      throw error;
    }
  }

  // Get all public configurations
  async getAllPublic() {
    try {
      const configs = await Config.find({ isPublic: true });
      
      // Convert to key-value object
      return configs.reduce((result, config) => {
        result[config.key] = config.value;
        return result;
      }, {});
    } catch (error) {
      logger.error(`Error getting all public configs:`, error);
      throw error;
    }
  }

  // Set a configuration value
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
      
      return true;
    } catch (error) {
      logger.error('Error initializing default configurations:', error);
      return false;
    }
  }
}

module.exports = new ConfigService();