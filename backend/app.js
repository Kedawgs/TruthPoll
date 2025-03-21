const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

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

// Mount routers
app.use('/api/polls', require('./routes/pollRoutes'));
app.use('/api/wallets', require('./routes/walletRoutes'));
app.use('/api/contracts', require('./routes/contractRoutes'));

// Basic route
app.get('/', (req, res) => {
  res.send('TruthPoll API is running');
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;