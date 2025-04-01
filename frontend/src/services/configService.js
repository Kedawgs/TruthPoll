// frontend/src/services/configService.js
import api from '../utils/api';
import logger from '../utils/logger';

// Configuration cache with default fallback values
let configCache = {
  POLYGON_AMOY_RPC_URL: process.env.REACT_APP_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/',
  POLYGON_AMOY_CHAIN_ID: 80002,
  FACTORY_ADDRESS: process.env.REACT_APP_FACTORY_ADDRESS || '',
  SMART_WALLET_FACTORY_ADDRESS: process.env.REACT_APP_SMART_WALLET_FACTORY_ADDRESS || '',
  USDT_ADDRESS: process.env.REACT_APP_USDT_ADDRESS || '',
  ENABLE_REWARDS: true
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

// Force refresh configuration
const refreshConfig = async () => {
  return await fetchConfig(true);
};

// Export the service methods
const configService = {
  getConfig,
  getAllConfig,
  refreshConfig
};

export default configService;