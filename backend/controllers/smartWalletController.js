// backend/controllers/smartWalletController.js
const ethers = require('ethers');
const logger = require('../utils/logger');

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
    
    // Get the service from app.locals
    const smartWalletService = req.app.locals.smartWalletService;
    
    // Verify the user is authenticated
    const { isMagicUser } = req.user || {};
    if (isMagicUser && req.user.publicAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized address'
      });
    }
    
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