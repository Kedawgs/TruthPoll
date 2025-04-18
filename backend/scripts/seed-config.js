// backend/scripts/seed-config.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const configService = require('../services/configService');
const logger = require('../utils/logger');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  logger.info('MongoDB connected');
  seedConfig();
}).catch(err => {
  logger.error('MongoDB connection error:', err);
  process.exit(1);
});

// Seed configuration values
async function seedConfig() {
  try {
    logger.info('Seeding configuration values...');
    
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
    
    // Add any other configuration values here...
    
    logger.info('Configuration seeded successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding configuration:', error);
    process.exit(1);
  }
}