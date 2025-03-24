// backend/services/smartWalletService.js
const ethers = require('ethers');
const SmartWalletFactory = require('../artifacts/contracts/SmartWalletFactory.sol/SmartWalletFactory.json');

class SmartWalletService {
  constructor(provider, platformPrivateKey) {
    this.provider = provider;
    this.platformWallet = new ethers.Wallet(platformPrivateKey, provider);
    this.factoryAddress = process.env.SMART_WALLET_FACTORY_ADDRESS;
    
    // Default gas settings for Polygon Amoy testnet
    this.gasSettings = {
      maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei"),
      maxFeePerGas: ethers.utils.parseUnits("35", "gwei"),
      gasLimit: 3000000
    };
    
    if (this.factoryAddress) {
      this.factory = new ethers.Contract(
        this.factoryAddress,
        SmartWalletFactory.abi,
        this.platformWallet
      );
      console.log(`SmartWalletFactory initialized at ${this.factoryAddress}`);
    } else {
      console.log('SmartWalletFactory address not set in environment variables');
    }
  }
  
  // Get wallet address for a user (counterfactual)
  async getWalletAddress(userAddress) {
    try {
      if (!this.factory) {
        throw new Error('Factory contract not initialized');
      }
      
      // Deterministic salt based on user address
      const salt = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['address'], [userAddress])
      );
      
      const walletAddress = await this.factory.getWalletAddress(userAddress, salt);
      console.log(`Smart wallet address for ${userAddress}: ${walletAddress}`);
      
      return walletAddress;
    } catch (error) {
      console.error('Error getting wallet address:', error);
      throw error;
    }
  }
  
  // Deploy wallet if needed - IMPROVED WITH CONFIRMATION
  async deployWalletIfNeeded(userAddress) {
    try {
      if (!this.factory) {
        throw new Error('Factory contract not initialized');
      }
      
      // Get fresh gas settings
      await this.getCurrentGasPrices();
      
      // Deterministic salt based on user address
      const salt = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['address'], [userAddress])
      );
      
      // Get the expected wallet address
      const walletAddress = await this.factory.getWalletAddress(userAddress, salt);
      console.log(`Expected smart wallet address: ${walletAddress}`);
      
      // Check if already deployed
      const code = await this.provider.getCode(walletAddress);
      const isDeployed = code !== '0x';
      
      console.log(`Smart wallet deployed? ${isDeployed}`);
      
      if (isDeployed) {
        console.log(`Smart wallet already deployed at ${walletAddress}`);
        return walletAddress;
      }
      
      console.log(`Deploying new smart wallet for ${userAddress}...`);
      
      // Deploy new wallet with updated gas settings
      const tx = await this.factory.createWallet(
        userAddress, 
        salt,
        this.gasSettings // Use the gas settings defined in constructor
      );
      
      console.log(`Deployment transaction submitted: ${tx.hash}`);
      
      // Wait for the transaction to be mined
      console.log('Waiting for deployment confirmation...');
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) {
        throw new Error('Smart wallet deployment failed');
      }
      
      console.log(`Smart wallet deployment confirmed, tx: ${receipt.transactionHash}`);
      
      // Verify deployment was successful
      const verifyCode = await this.provider.getCode(walletAddress);
      if (verifyCode === '0x') {
        throw new Error('Smart wallet code not found after deployment');
      }
      
      // Wait for a short time to ensure state is updated on the blockchain
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`Smart wallet successfully deployed at ${walletAddress}`);
      return walletAddress;
    } catch (error) {
      console.error('Error deploying wallet:', error);
      if (error.reason) console.error('Error reason:', error.reason);
      if (error.code) console.error('Error code:', error.code);
      if (error.body) console.error('Error response body:', error.body);
      throw error;
    }
  }
  
  // Check if wallet is deployed - ENHANCED WITH MORE DETAILED LOGS
  async isWalletDeployed(walletAddress) {
    try {
      console.log(`Checking if wallet is deployed at ${walletAddress}...`);
      const code = await this.provider.getCode(walletAddress);
      const isDeployed = code !== '0x';
      
      console.log(`Wallet deployment status: ${isDeployed ? 'Deployed' : 'Not deployed'}`);
      console.log(`Code length: ${(code.length - 2) / 2} bytes`);
      
      return isDeployed;
    } catch (error) {
      console.error('Error checking if wallet is deployed:', error);
      throw error;
    }
  }
  
  // Get current gas prices from the network
  async getCurrentGasPrices() {
    try {
      const feeData = await this.provider.getFeeData();
      
      console.log("Current network gas prices:", {
        maxFeePerGas: ethers.utils.formatUnits(feeData.maxFeePerGas, "gwei") + " GWEI",
        maxPriorityFeePerGas: ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " GWEI"
      });
      
      // Update the gas settings with current values (while ensuring minimums)
      this.gasSettings = {
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.gt(ethers.utils.parseUnits("25", "gwei")) 
          ? feeData.maxPriorityFeePerGas 
          : ethers.utils.parseUnits("30", "gwei"),
        maxFeePerGas: feeData.maxFeePerGas.gt(ethers.utils.parseUnits("30", "gwei"))
          ? feeData.maxFeePerGas
          : ethers.utils.parseUnits("35", "gwei"),
        gasLimit: 3000000
      };
      
      return this.gasSettings;
    } catch (error) {
      console.error('Error fetching gas prices:', error);
      // Return default values if fetching fails
      return this.gasSettings;
    }
  }
}

module.exports = SmartWalletService;