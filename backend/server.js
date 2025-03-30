// backend/server.js
require('dotenv').config();
const { app, initializeApp } = require('./app');
const logger = require('./utils/logger');

// Port to run server on
const PORT = process.env.PORT || 5000;

// Graceful shutdown function
const shutdownGracefully = (server) => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds if not closed gracefully
  setTimeout(() => {
    logger.error('Server shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
};

// Initialize app and start server
(async () => {
  try {
    // Initialize the application (connects DB, sets up blockchain services)
    await initializeApp();
    
    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => shutdownGracefully(server));
    process.on('SIGINT', () => shutdownGracefully(server));
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Promise Rejection: ${err.message}`);
      logger.error(err.stack);
      // Not exiting process - just logging for now to maintain uptime
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
})();