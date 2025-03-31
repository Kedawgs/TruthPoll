// backend/controllers/smartWalletController.js
const logger = require('../utils/logger');
const { AuthorizationError } = require('../utils/errorTypes');

exports.getWalletAddress = async (req, res) => {
  try {
    // Address is validated by middleware
    const userAddress = req.params.address;
    
    // Get the service from app.locals
    const smartWalletService = req.app.locals.smartWalletService;
    
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
    // Address validation handled by middleware
    const { userAddress, signature } = req.body;
    
    // Get the service from app.locals
    const smartWalletService = req.app.locals.smartWalletService;
    
    // For Magic users, verification is already done by middleware
    // For non-Magic users, verify the signature
    if (!req.user?.isMagicUser) {
      if (!signature) {
        return res.status(400).json({
          success: false,
          error: 'Signature is required for wallet deployment'
        });
      }
      
      // Validate the signature
      const isValid = await smartWalletService.validateWalletDeploymentSignature(
        userAddress,
        signature
      );
      
      if (!isValid) {
        return res.status(403).json({
          success: false,
          error: 'Invalid signature for wallet deployment'
        });
      }
      
      logger.info(`Signature validated for wallet deployment: ${userAddress}`);
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