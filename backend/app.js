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

// Initialize express app
const app = express();

// --- Core Middleware ---

// Security middleware
app.use(helmet()); // Set various security HTTP headers

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

// Apply Magic Auth Middleware (if it populates req.user for Magic users correctly)
// Place this strategically if Magic needs to be checked before JWT or vice-versa
// If magicAuth *only* verifies Magic tokens and doesn't interfere with Authorization headers,
// its position relative to JWT middleware might not matter as much. If it *does* populate
// req.user, place it appropriately depending on which auth method takes precedence if both are present.
app.use(magicAuth);

// Apply Passport JWT Authentication Middleware
// This middleware will attempt to authenticate using the JWT strategy for *every* request after this point.
// It populates req.user if a valid JWT bearer token is found, otherwise does nothing and passes control.
app.use((req, res, next) => {
    // Check if req.user is already populated (e.g., by magicAuth)
    // If you want JWT to potentially override or run only if magicAuth didn't authenticate:
    // if (req.user) {
    //     logger.debug('User already authenticated (potentially by Magic), skipping JWT check.');
    //     return next();
    // }

    passport.authenticate('jwt', { session: false }, (err, user, info) => {
        if (err) {
            logger.error("Passport JWT Auth Error:", err);
            // Decide if you want to halt on error or just log and continue
            return next(err); // Pass error to error handler
        }
        if (user) {
            // Authentication successful, attach user payload to request
            req.user = user; // This makes req.user available to subsequent middleware/routes
            logger.debug(`JWT Authenticated User: ${user.publicAddress}`);
        } else {
            // No token provided, or token invalid/expired.
            // Do not reject request here; let protected routes handle it via isAuthenticated middleware.
            // Log info if available (e.g., 'No auth token', 'jwt expired')
             if (info instanceof Error) {
                 logger.debug(`JWT Auth Info: ${info.message}`);
             } else if (info && info.message) {
                 logger.debug(`JWT Auth Info: ${info.message}`);
             } else if (info) {
                 logger.debug(`JWT Auth Info: ${JSON.stringify(info)}`);
             } else {
                 // Only log if Authorization header was present but failed validation
                 if(req.headers.authorization?.startsWith('Bearer ')) {
                     logger.debug("JWT Auth Info: Invalid or expired token provided.");
                 } else {
                     logger.debug("No JWT bearer token provided for this request.");
                 }
             }
        }
        next(); // Proceed to the next middleware or route handler
    })(req, res, next); // Immediately invoke the middleware function created by passport.authenticate
});


// --- Request Logging ---
// Place after auth middleware so we can log the user if available
app.use((req, res, next) => {
    const userLog = req.user ? `(User: ${req.user.publicAddress})` : '(No User)';
    logger.http(`${req.method} ${req.originalUrl} ${userLog}`); // Log request with user info if present
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
        app.use('/api/polls', require('./routes/pollRoutes'));
        app.use('/api/contracts', require('./routes/contractRoutes'));
        app.use('/api/auth', require('./routes/authRoutes'));
        app.use('/api/smart-wallets', require('./routes/smartWalletRoutes'));
        app.use('/api/users', require('./routes/userRoutes'));

        // Basic health check route
        app.get('/', (req, res) => {
            res.send('TruthPoll API is running');
        });

        // --- 404 Handler ---
        // Catch-all for requests that don't match any route
        app.use((req, res, next) => {
            res.status(404).json({
                success: false,
                error: `Route not found: ${req.originalUrl}`
            });
        });

        // --- Global Error Handler ---
        // Must be the LAST middleware
        app.use(errorHandler);

        return app; // Return the configured app instance
    } catch (error) {
        // Log initialization errors and exit
        logger.error('Failed to initialize application:', error);
        process.exit(1); // Exit process if essential initialization fails
    }
};

// Export initialization function (and app if needed directly elsewhere, though less common)
module.exports = { initializeApp, app }; // Use initializeApp in your server start script