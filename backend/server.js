// backend/server.js

// Load environment variables FIRST
const dotenv = require('dotenv');
dotenv.config(); // Load .env file contents into process.env

const { initializeApp } = require('./app');
const http = require('http');
const logger = require('./utils/logger');
const connectDB = require('./config/database');
const configService = require('./services/configService');

// Port to run server on
const PORT = process.env.PORT || 5000;

// Socket.io setup (required here for the update)
const socketIo = require('socket.io');

// This function should be modified to include our transaction cost estimates
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
      
      // NEW: Transaction cost estimates
      await configService.set(
        'ESTIMATED_TX_COST',
        0.001, // Default cost in MATIC
        true,
        'Estimated transaction cost for poll operations on Polygon Amoy (in MATIC)'
      );
      
      // NEW: Platform fee percentage
      await configService.set(
        'PLATFORM_FEE_PERCENT',
        6, // 6% platform fee
        true,
        'Platform fee percentage applied to poll rewards'
      );

      logger.info('Initial configuration seeded successfully');
    }
    
    // Additionally, always initialize any missing default values
    // This ensures that even if the main config exists but our new values don't,
    // they will be created
    await configService.initializeDefaults();
    
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

    // Initialize the Express app (connects DB, sets up blockchain services)
    const app = await initializeApp();

    // --- Start of Updated Section ---

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO with CORS settings
    const io = socketIo(server, {
      cors: {
        origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'], // Added allowedHeaders for completeness based on old code
        credentials: true
      }
    });

    // Socket.IO connection handler
    io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });

    // Make io available throughout the app (via app.locals)
    app.locals.io = io;

    // Listen on the server instead of app
    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // --- End of Updated Section ---

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
    logger.error(error.stack); // Log stack trace for better debugging
    process.exit(1);
  }
})();