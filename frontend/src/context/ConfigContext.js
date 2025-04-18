// frontend/src/context/ConfigContext.js
import React, { createContext, useState, useEffect } from 'react';
import configService from '../services/configService';
import logger from '../utils/logger';

// Create context
export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const configData = await configService.getAllConfig();
        setConfig(configData);
        setLoading(false);
      } catch (err) {
        logger.error('Error loading configuration:', err);
        setError('Failed to load application configuration');
        setLoading(false);
      }
    };
    
    loadConfig();
  }, []);
  
  // Refresh configuration
  const refreshConfig = async () => {
    try {
      setLoading(true);
      const configData = await configService.refreshConfig();
      setConfig(configData);
      setLoading(false);
      return true;
    } catch (err) {
      logger.error('Error refreshing configuration:', err);
      setError('Failed to refresh configuration');
      setLoading(false);
      return false;
    }
  };
  
  // Get a configuration value
  const getConfigValue = (key, defaultValue = null) => {
    return config[key] !== undefined ? config[key] : defaultValue;
  };
  
  return (
    <ConfigContext.Provider
      value={{
        config,
        loading,
        error,
        refreshConfig,
        getConfigValue
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};