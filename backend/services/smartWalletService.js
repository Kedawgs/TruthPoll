// backend/services/smartWalletService.js
const ethers = require('ethers');
const SmartWalletFactory = require('../artifacts/contracts/SmartWalletFactory.sol/SmartWalletFactory.json');

class SmartWalletService {
  constructor(provider, platformPrivateKey) {
    this.provider = provider;
    this.platformWallet = new ethers.Wallet(platformPrivateKey, provider);
    this.factoryAddress = process.env.SMART_WALLET_FACTORY_ADDRESS;
    
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
      
      // Deploy new wallet
      const tx = await this.factory.createWallet(
        userAddress, 
        salt,
        { gasLimit: 1000000 }
      );
      
      console.log(`Deployment transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Smart wallet deployed at ${walletAddress}, tx: ${receipt.transactionHash}`);
      
      return walletAddress;
    } catch (error) {
      console.error('Error deploying wallet:', error);
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
}

module.exports = SmartWalletService;