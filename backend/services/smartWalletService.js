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
  
  // Deploy wallet if needed
  async deployWalletIfNeeded(userAddress) {
    try {
      if (!this.factory) {
        throw new Error('Factory contract not initialized');
      }
      
      // Deterministic salt based on user address
      const salt = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['address'], [userAddress])
      );
      
      // Check if already deployed
      const walletAddress = await this.factory.getWalletAddress(userAddress, salt);
      const code = await this.provider.getCode(walletAddress);
      
      if (code !== '0x') {
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
      
      const receipt = await tx.wait();
      console.log(`Smart wallet deployed at ${walletAddress}, tx: ${receipt.transactionHash}`);
      
      return walletAddress;
    } catch (error) {
      console.error('Error deploying wallet:', error);
      if (error.reason) console.error('Error reason:', error.reason);
      if (error.code) console.error('Error code:', error.code);
      if (error.body) console.error('Error response body:', error.body);
      throw error;
    }
  }
  
  // Check if wallet is deployed
  async isWalletDeployed(walletAddress) {
    try {
      const code = await this.provider.getCode(walletAddress);
      return code !== '0x';
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