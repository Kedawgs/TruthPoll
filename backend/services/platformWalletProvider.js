// backend/services/platformWalletProvider.js
const ethers = require('ethers');
const logger = require('../utils/logger');

class PlatformWalletProvider {
  constructor(provider) {
    this.provider = provider;
    this._wallet = null;
    this._initialized = false;
    this._lastAccess = 0;
    this._accessCount = 0;
  }

  async initialize() {
    const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('PLATFORM_WALLET_PRIVATE_KEY environment variable is not set');
    }
    
    try {
      this._wallet = new ethers.Wallet(privateKey, this.provider);
      this._initialized = true;
      
      // Log non-sensitive information to confirm initialization
      logger.info(`Platform wallet initialized: ${this._wallet.address}`);
      
      return this._wallet.address;
    } catch (error) {
      logger.error(`Failed to initialize platform wallet: ${error.message}`);
      throw new Error(`Failed to initialize platform wallet: ${error.message}`);
    }
  }
  
  async getSigner(operation) {
    if (!this._initialized) {
      await this.initialize();
    }
    
    // Simple rate limiting to prevent abuse
    const now = Date.now();
    if (now - this._lastAccess < 100) { // 100ms cooldown
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Log access (without private key info)
    this._lastAccess = Date.now();
    this._accessCount++;
    
    if (this._accessCount % 50 === 0) {
      logger.info(`Platform wallet accessed ${this._accessCount} times. Latest operation: ${operation}`);
    }
    
    return this._wallet;
  }
  
  async getAddress() {
    if (!this._initialized) {
      await this.initialize();
    }
    
    return this._wallet.address;
  }
  
  // Helper to create a contract connection with the signer
  async getSignedContract(contractAddress, abi, operation) {
    if (!this._initialized) {
      await this.initialize();
    }
    
    const contract = new ethers.Contract(contractAddress, abi, this.provider);
    const signer = await this.getSigner(operation);
    return contract.connect(signer);
  }
}

module.exports = PlatformWalletProvider;