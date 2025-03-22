const ethers = require('ethers');
const ProxyWalletService = require('../services/proxyWalletService');
const ProxyWallet = require('../models/ProxyWallet');

// Create provider
const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);

// Initialize proxy wallet service
const proxyWalletService = new ProxyWalletService(provider);

/**
 * @desc    Create a proxy wallet
 * @route   POST /api/wallets
 * @access  Public
 */
exports.createWallet = async (req, res) => {
  try {
    const { userAddress } = req.body;
    const { isMagicUser } = req.user || {};
    
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a user address'
      });
    }
    
    console.log(`Creating wallet for user: ${userAddress}`);
    
    // For Magic users, return their address directly without creating a proxy wallet
    if (isMagicUser) {
      return res.status(201).json({
        success: true,
        data: {
          address: userAddress,
          isMagicUser: true
        }
      });
    }
    
    // Create or get existing proxy wallet for non-Magic users
    const wallet = await proxyWalletService.createProxyWallet(userAddress);
    
    console.log(`Wallet created successfully: ${JSON.stringify(wallet)}`);
    
    res.status(201).json({
      success: true,
      data: wallet
    });
  } catch (error) {
    console.error('Error in createWallet controller:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Fund a proxy wallet
 * @route   POST /api/wallets/fund
 * @access  Public
 */
exports.fundWallet = async (req, res) => {
  try {
    const { userAddress, amount } = req.body;
    const { isMagicUser } = req.user || {};
    
    if (!userAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Please provide user address and amount'
      });
    }
    
    // For Magic users, we can't fund their wallet directly
    if (isMagicUser) {
      return res.status(400).json({
        success: false,
        error: 'Direct funding not supported for Magic.link users'
      });
    }
    
    // Fund the wallet
    const receipt = await proxyWalletService.fundProxyWallet(userAddress, amount);
    
    res.status(200).json({
      success: true,
      data: {
        transactionHash: receipt.transactionHash,
        amount
      }
    });
  } catch (error) {
    console.error('Error funding wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Get wallet details
 * @route   GET /api/wallets/:address
 * @access  Public
 */
exports.getWallet = async (req, res) => {
  try {
    const userAddress = req.params.address;
    const { isMagicUser } = req.user || {};
    
    // For Magic users, return address info directly
    if (isMagicUser && req.user.publicAddress === userAddress) {
      const balance = await provider.getBalance(userAddress);
      
      return res.status(200).json({
        success: true,
        data: {
          userAddress: userAddress,
          proxyAddress: userAddress, // Same address for Magic users
          balance: ethers.utils.formatEther(balance),
          isMagicUser: true
        }
      });
    }
    
    // Find the wallet in the database for non-Magic users
    const wallet = await ProxyWallet.findOne({ userAddress });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }
    
    // Get the current balance from the blockchain
    const balance = await provider.getBalance(wallet.proxyAddress);
    
    res.status(200).json({
      success: true,
      data: {
        userAddress: wallet.userAddress,
        proxyAddress: wallet.proxyAddress,
        balance: ethers.utils.formatEther(balance),
        createdAt: wallet.createdAt,
        lastUsed: wallet.lastUsed
      }
    });
  } catch (error) {
    console.error('Error getting wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Execute a transaction with a proxy wallet
 * @route   POST /api/wallets/execute
 * @access  Public
 */
exports.executeTransaction = async (req, res) => {
  try {
    const { userAddress, toAddress, data, value = '0' } = req.body;
    const { isMagicUser } = req.user || {};
    
    if (!userAddress || !toAddress) {
      return res.status(400).json({
        success: false,
        error: 'Please provide user address and destination address'
      });
    }
    
    // For Magic users, transactions are handled by Magic.link on the frontend
    if (isMagicUser) {
      return res.status(400).json({
        success: false,
        error: 'Server-side transaction execution not supported for Magic.link users'
      });
    }
    
    // Execute the transaction for non-Magic users
    const receipt = await proxyWalletService.executeTransaction(
      userAddress,
      toAddress,
      data,
      value
    );
    
    res.status(200).json({
      success: true,
      data: {
        transactionHash: receipt.transactionHash,
        from: receipt.from,
        to: receipt.to,
        value: ethers.utils.formatEther(receipt.value || '0')
      }
    });
  } catch (error) {
    console.error('Error executing transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};