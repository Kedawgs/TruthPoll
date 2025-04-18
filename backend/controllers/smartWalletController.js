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

// New controller function for relaying transactions
exports.relayTransaction = async (req, res) => {
  try {
    // Get data from request
    const {
      smartWalletAddress,
      targetAddress,
      callData,
      signature,
      value = "0"
    } = req.body;
    
    // Get the relayer service
    const relayerService = req.app.locals.relayerService;
    
    // Validate the signature if this is a smart wallet transaction
    const verificationResult = await relayerService.verifySmartWalletSignature(
      smartWalletAddress,
      targetAddress,
      callData,
      signature
    );
    
    if (!verificationResult.isValid) {
      return res.status(403).json({
        success: false,
        error: 'Invalid signature. Transaction not authorized by wallet owner.'
      });
    }
    
    logger.info(`Relaying transaction from smart wallet ${smartWalletAddress} to ${targetAddress}`);
    
    // Execute the transaction
    const result = await relayerService.relaySmartWalletTransaction(
      smartWalletAddress,
      targetAddress,
      callData,
      signature
    );
    
    res.status(200).json({
      success: true,
      data: {
        transactionHash: result.transactionHash
      }
    });
  } catch (error) {
    logger.error('Error relaying transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Transaction relay failed'
    });
  }
};