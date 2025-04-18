// backend/app.js

// Load environment variables FIRST
const dotenv = require('dotenv');
dotenv.config(); // Load .env file contents into process.env

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const ethers = require('ethers');
const passport = require('./config/passport'); // Import configured passport instance
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const magicAuth = require('./middleware/magicAuth'); // Keep if needed for Magic Link specific handling
const logger = require('./utils/logger');

// Import services
const PlatformWalletProvider = require('./services/platformWalletProvider');
const SmartWalletService = require('./services/smartWalletService');
const ContractService = require('./services/contractService');
const RelayerService = require('./services/relayerService');
const PollService = require('./services/pollService');

// Import Routers (Best practice to import them here)
const pollRoutes = require('./routes/pollRoutes');
const contractRoutes = require('./routes/contractRoutes');
const authRoutes = require('./routes/authRoutes');
const smartWalletRoutes = require('./routes/smartWalletRoutes');
const userRoutes = require('./routes/userRoutes');
const configRoutes = require('./routes/configRoutes');
const activityRoutes = require('./routes/activityRoutes'); // Import activity routes

// Initialize express app
const app = express();

// --- Core Middleware ---

// Security middleware with enhanced Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Consider restricting further in production
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.s3.amazonaws.com"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
})); // Set various security HTTP headers

// CORS Configuration (ensure origins are correctly set in .env)
const corsOptions = {
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Added OPTIONS for preflight
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight across-the-board

// Request parsing middleware
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded request bodies

// --- Authentication Middleware Setup ---

// Initialize Passport
app.use(passport.initialize());

// Apply Magic Auth Middleware (Place strategically based on auth precedence)
app.use(magicAuth);

// Apply Passport JWT Authentication Middleware (Populates req.user if valid token found)
app.use((req, res, next) => {
    // Optional: Check if user already authenticated (e.g., by magicAuth)
    // if (req.user) { return next(); }

    passport.authenticate('jwt', { session: false }, (err, user, info) => {
        if (err) {
            logger.error("Passport JWT Auth Error:", err);
            return next(err); // Pass error to error handler
        }
        if (user) {
            req.user = user; // Attach user payload to request
            logger.debug(`JWT Authenticated User: ${user.publicAddress}`);
        } else {
            // Log reason if available, but don't reject request here
             if (info instanceof Error) {
                  logger.debug(`JWT Auth Info: ${info.message}`);
             } else if (info && info.message) {
                  logger.debug(`JWT Auth Info: ${info.message}`);
             } else if (info) {
                  logger.debug(`JWT Auth Info: ${JSON.stringify(info)}`);
             } else {
                  if(req.headers.authorization?.startsWith('Bearer ')) {
                      logger.debug("JWT Auth Info: Invalid or expired token provided.");
                  } else {
                      // Avoid logging for every unauthenticated request unless debugging
                      // logger.debug("No JWT bearer token provided for this request.");
                  }
             }
        }
        next(); // Proceed to the next middleware/route
    })(req, res, next); // Immediately invoke the middleware
});


// --- Request Logging ---
// Place after auth middleware to log user info if available
app.use((req, res, next) => {
    const userLog = req.user ? `(User: ${req.user.publicAddress})` : '(No User)';
    logger.http(`${req.method} ${req.originalUrl} ${userLog}`); // Log request details
    next();
});


// --- Service Initialization ---
const initializeBlockchainServices = async () => {
    try {
        const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);
        const platformWalletProvider = new PlatformWalletProvider(provider);
        const walletAddress = await platformWalletProvider.initialize();
        logger.info(`Platform wallet initialized with address: ${walletAddress}`);

        const smartWalletService = new SmartWalletService(provider, platformWalletProvider);
        const contractService = new ContractService(provider, platformWalletProvider);
        const relayerService = new RelayerService(provider, platformWalletProvider);
        const pollService = new PollService(provider, platformWalletProvider);

        // Make services available globally via app.locals
        app.locals.smartWalletService = smartWalletService;
        app.locals.contractService = contractService;
        app.locals.relayerService = relayerService;
        app.locals.pollService = pollService;

        logger.info('Blockchain services successfully initialized');
        return true;
    } catch (error) {
        logger.error('Failed to initialize blockchain services:', error);
        throw error; // Re-throw to be caught by initializeApp
    }
};

// --- Application Initialization Function ---
const initializeApp = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Initialize blockchain services
        await initializeBlockchainServices();

        // --- Mount API Routers ---
        // These come AFTER auth middleware so req.user can be populated
        app.use('/api/polls', pollRoutes);
        app.use('/api/contracts', contractRoutes);
        app.use('/api/auth', authRoutes);
        app.use('/api/smart-wallets', smartWalletRoutes);
        app.use('/api/users', userRoutes);
        app.use('/api/config', configRoutes);
        app.use('/api/activity', activityRoutes); // <<< CORRECTLY MOUNTED HERE

        // Basic health check route
        app.get('/', (req, res) => {
            res.send('TruthPoll API is running');
        }); // <<< Correctly closed

        // --- 404 Handler ---
        // Catch-all for requests that don't match any defined route above
        app.use((req, res, next) => {
            res.status(404).json({
                success: false,
                error: `Route not found: ${req.originalUrl}`
            });
        });

        // --- Global Error Handler ---
        // Must be the LAST middleware defined
        app.use(errorHandler);

        return app; // Return the configured app instance
    } catch (error) {
        // Log initialization errors and exit
        logger.error('Failed to initialize application:', error);
        process.exit(1); // Exit process if essential initialization fails
    }
};

// Export initialization function (used in server.js)
module.exports = { initializeApp, app }; // Export app mainly for potential testing setups