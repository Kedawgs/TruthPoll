// backend/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const magicAuth = require('./middleware/magicAuth');
const logger = require('./utils/logger');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

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

// Mount routers
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

module.exports = app;