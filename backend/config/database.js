// backend/config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Function to connect to MongoDB
const connectDB = async () => {
  try {
    // Configure mongoose
    mongoose.set('strictQuery', false);
    
    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected, trying to reconnect...');
    });
    
    // Add graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed due to app termination');
        process.exit(0);
      } catch (err) {
        logger.error(`Error during MongoDB disconnection: ${err}`);
        process.exit(1);
      }
    });
    
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;