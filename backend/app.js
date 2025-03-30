// backend/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const ethers = require('ethers');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const magicAuth = require('./middleware/magicAuth');
const logger = require('./utils/logger');

// Import services
const PlatformWalletProvider = require('./services/platformWalletProvider');
const SmartWalletService = require('./services/smartWalletService');
const ContractService = require('./services/contractService');
const RelayerService = require('./services/relayerService');
const PollService = require('./services/pollService');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies
app.use(magicAuth); // Add Magic authentication middleware

// Request logging middleware
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.url}`);
  next();
});

// Initialize blockchain services
const initializeBlockchainServices = async () => {
  try {
    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);
    
    // Initialize platform wallet provider
    const platformWalletProvider = new PlatformWalletProvider(provider);
    
    // Initialize platform wallet
    const walletAddress = await platformWalletProvider.initialize();
    logger.info(`Platform wallet initialized with address: ${walletAddress}`);
    
    // Initialize services with the platform wallet provider
    const smartWalletService = new SmartWalletService(provider, platformWalletProvider);
    const contractService = new ContractService(provider, platformWalletProvider);
    const relayerService = new RelayerService(provider, platformWalletProvider);
    
    // Initialize the poll service with the necessary dependencies
    const pollService = new PollService(
      provider, 
      platformWalletProvider
    );
    
    // Make services available to routes/controllers via app.locals
    app.locals.smartWalletService = smartWalletService;
    app.locals.contractService = contractService;
    app.locals.relayerService = relayerService;
    app.locals.pollService = pollService;
    
    logger.info('Blockchain services successfully initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize blockchain services:', error);
    throw error;
  }
};

// Connect to database and initialize services before starting the server
const initializeApp = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Initialize blockchain services
    await initializeBlockchainServices();
    
    // Mount routers after services are initialized
    app.use('/api/polls', require('./routes/pollRoutes'));
    app.use('/api/contracts', require('./routes/contractRoutes'));
    app.use('/api/auth', require('./routes/authRoutes'));
    app.use('/api/smart-wallets', require('./routes/smartWalletRoutes'));
    app.use('/api/users', require('./routes/userRoutes'));
    
    // Basic route
    app.get('/', (req, res) => {
      res.send('TruthPoll API is running');
    });
    
    // 404 handler
    app.use((req, res, next) => {
      res.status(404).json({
        success: false,
        error: `Route not found: ${req.originalUrl}`
      });
    });
    
    // Error handling middleware
    app.use(errorHandler);
    
    return app;
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

// Export both the app and the initialization function
module.exports = { app, initializeApp };