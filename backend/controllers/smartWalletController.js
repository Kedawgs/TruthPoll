// backend/controllers/smartWalletController.js
const ethers = require('ethers');
const logger = require('../utils/logger');
const { ValidationError, AuthorizationError } = require('../utils/errorTypes');

exports.getWalletAddress = async (req, res) => {
  try {
    const userAddress = req.params.address;
    
    // Get the service from app.locals
    const smartWalletService = req.app.locals.smartWalletService;
    
    // Validate address format
    if (!ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }
    
    // Get the counterfactual address
    const walletAddress = await smartWalletService.getWalletAddress(userAddress);
    
    // Check if it's deployed
    const isDeployed = await smartWalletService.isWalletDeployed(walletAddress);
    
    res.status(200).json({
      success: true,
      data: {
        address: walletAddress,
        isDeployed
      }
    });
  } catch (error) {
    logger.error('Error getting wallet address:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

exports.deployWallet = async (req, res) => {
  try {
    const { userAddress } = req.body;
    
    // Validate request
    if (!userAddress || !ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Valid userAddress is required'
      });
    }
    
    // Get the service from app.locals
    const smartWalletService = req.app.locals.smartWalletService;
    
    // NOTE: Address verification happens in the middleware
    // We could add extra checks here for non-Magic users
    
    // Deploy the wallet
    const walletAddress = await smartWalletService.deployWalletIfNeeded(userAddress);
    
    res.status(200).json({
      success: true,
      data: {
        address: walletAddress,
        isDeployed: true
      }
    });
  } catch (error) {
    logger.error('Error deploying wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};