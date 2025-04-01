// backend/services/configService.js
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
}

module.exports = new ConfigService();