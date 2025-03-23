// backend/controllers/smartWalletController.js
const ethers = require('ethers');
const SmartWalletService = require('../services/smartWalletService');

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);

// Initialize service
const smartWalletService = new SmartWalletService(
  provider,
  process.env.PLATFORM_WALLET_PRIVATE_KEY
);

exports.getWalletAddress = async (req, res) => {
  try {
    const userAddress = req.params.address;
    
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
    console.error('Error getting wallet address:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

exports.deployWallet = async (req, res) => {
  try {
    const { userAddress } = req.body;
    
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
    console.error('Error deploying wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};