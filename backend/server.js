// backend/server.js
require('dotenv').config();
const { app, initializeApp } = require('./app');
const logger = require('./utils/logger');
const connectDB = require('./config/database');
const configService = require('./services/configService');

// Port to run server on
const PORT = process.env.PORT || 5000;

// Seed initial configuration values
const seedInitialConfig = async () => {
  try {
    // Check if any configurations exist
    const existingConfig = await configService.getMultiple(['POLYGON_AMOY_RPC_URL']);
    
    // If no configurations found, seed initial values
    if (!existingConfig.POLYGON_AMOY_RPC_URL) {
      logger.info('No configurations found, seeding initial values...');
      
      // Network configuration
      await configService.set(
        'POLYGON_AMOY_RPC_URL', 
        process.env.POLYGON_AMOY_RPC_URL,
        true,
        'Polygon Amoy RPC URL'
      );
      
      await configService.set(
        'POLYGON_AMOY_CHAIN_ID', 
        80002,
        true,
        'Polygon Amoy Chain ID'
      );
      
      // Contract addresses
      await configService.set(
        'FACTORY_ADDRESS', 
        process.env.FACTORY_ADDRESS,
        true,
        'Poll Factory Contract Address'
      );
      
      await configService.set(
        'SMART_WALLET_FACTORY_ADDRESS', 
        process.env.SMART_WALLET_FACTORY_ADDRESS,
        true,
        'Smart Wallet Factory Contract Address'
      );
      
      await configService.set(
        'USDT_ADDRESS', 
        process.env.USDT_ADDRESS,
        true,
        'Test USDT Token Address'
      );
      
      // Feature flags (example)
      await configService.set(
        'ENABLE_REWARDS', 
        true,
        true,
        'Enable poll rewards feature'
      );
      
      // Magic.link configuration
      await configService.set(
        'MAGIC_PUBLISHABLE_KEY', 
        process.env.MAGIC_PUBLISHABLE_KEY,
        true,
        'Magic.link Publishable Key for Frontend'
      );
      
      // JWT settings
      await configService.set(
        'JWT_EXPIRES_IN', 
        process.env.JWT_EXPIRES_IN || '1d',
        false, // Keep private
        'JWT Token Expiration Time'
      );
      
      logger.info('Initial configuration seeded successfully');
    }
  } catch (error) {
    logger.error('Error seeding initial configuration:', error);
  }
};

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
    // Connect to MongoDB
    await connectDB();
    
    // Seed initial configuration
    await seedInitialConfig();
    
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