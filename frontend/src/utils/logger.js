// src/utils/logger.js
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };
  
  // Set this based on environment
  const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
    ? LOG_LEVELS.WARN  // Only show warnings and errors in production
    : LOG_LEVELS.DEBUG; // Show all logs in development
  
  const logger = {
    debug: (message, ...args) => {
      if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
        console.debug(`[DEBUG] ${message}`, ...args);
      }
    },
    
    info: (message, ...args) => {
      if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
        console.info(`[INFO] ${message}`, ...args);
      }
    },
    
    warn: (message, ...args) => {
      if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
        console.warn(`[WARN] ${message}`, ...args);
      }
    },
    
    error: (message, ...args) => {
      if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
        console.error(`[ERROR] ${message}`, ...args);
      }
      
      // Optionally send critical errors to a backend service
      // if (process.env.NODE_ENV === 'production') {
      //   sendErrorToService(message, ...args);
      // }
    }
  };
  
  export default logger;