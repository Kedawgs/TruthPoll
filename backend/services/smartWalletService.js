// backend/services/smartWalletService.js
const ethers = require('ethers');
const SmartWalletFactory = require('../artifacts/contracts/SmartWalletFactory.sol/SmartWalletFactory.json');
const logger = require('../utils/logger');

class SmartWalletService {
  constructor(provider, platformWalletProvider) {
    this.provider = provider;
    this.platformWalletProvider = platformWalletProvider;
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
        this.provider
      );
      logger.info(`SmartWalletFactory initialized at ${this.factoryAddress}`);
    } else {
      logger.warn('SmartWalletFactory address not set in environment variables');
    }
  }
  
  /**
   * Validate a signature for wallet deployment
   * @param {string} userAddress - The address of the wallet owner
   * @param {string} signature - The signature to validate
   * @returns {Promise<boolean>} Whether the signature is valid
   */
  async validateWalletDeploymentSignature(userAddress, signature) {
    try {
      logger.debug(`Validating wallet deployment signature for ${userAddress}`);
      
      // Normalize the address
      const normalizedAddress = userAddress.toLowerCase();
      
      // Create a unique message that the user must have signed
      // Including the address in the message prevents signature reuse for other addresses
      const message = `I authorize the deployment of a smart wallet for ${normalizedAddress} on TruthPoll`;
      
      logger.debug(`Validation message: "${message}"`);
      
      try {
        // Recover the signer address from the signature
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);
        logger.debug(`Recovered signer address: ${recoveredAddress}`);
        
        // Check if recovered address matches the user address (case-insensitive)
        const isValid = recoveredAddress.toLowerCase() === normalizedAddress;
        
        if (!isValid) {
          logger.warn(`Signature validation failed: recovered=${recoveredAddress}, expected=${normalizedAddress}`);
        } else {
          logger.debug(`Signature validated successfully for ${normalizedAddress}`);
        }
        
        return isValid;
      } catch (signatureError) {
        logger.error(`Error processing signature: ${signatureError.message}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error validating wallet deployment signature: ${error.message}`);
      return false;
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
      logger.info(`Smart wallet address for ${userAddress}: ${walletAddress}`);
      
      return walletAddress;
    } catch (error) {
      logger.error('Error getting wallet address:', error);
      throw error;
    }
  }
  
  // Check if wallet is deployed
  async isWalletDeployed(walletAddress) {
    try {
      logger.info(`Checking if wallet is deployed at ${walletAddress}...`);
      const code = await this.provider.getCode(walletAddress);
      const isDeployed = code !== '0x';
      
      logger.info(`Wallet deployment status: ${isDeployed ? 'Deployed' : 'Not deployed'}`);
      logger.info(`Code length: ${(code.length - 2) / 2} bytes`);
      
      return isDeployed;
    } catch (error) {
      logger.error('Error checking if wallet is deployed:', error);
      throw error;
    }
  }
  
  // Deploy wallet if needed - IMPROVED for security
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
      logger.info(`Expected smart wallet address: ${walletAddress}`);
      
      // Check if already deployed
      const code = await this.provider.getCode(walletAddress);
      const isDeployed = code !== '0x';
      
      logger.info(`Smart wallet deployed? ${isDeployed}`);
      
      if (isDeployed) {
        logger.info(`Smart wallet already deployed at ${walletAddress}`);
        return walletAddress;
      }
      
      logger.info(`Deploying new smart wallet for ${userAddress}...`);
      
      // Get signed contract via platform wallet provider
      const signedFactory = await this.platformWalletProvider.getSignedContract(
        this.factoryAddress,
        SmartWalletFactory.abi,
        'deploy_wallet'
      );
      
      // Deploy new wallet with updated gas settings
      const tx = await signedFactory.createWallet(
        userAddress, 
        salt,
        this.gasSettings
      );
      
      logger.info(`Deployment transaction submitted: ${tx.hash}`);
      
      // Wait for the transaction to be mined
      logger.info('Waiting for deployment confirmation...');
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) {
        throw new Error('Smart wallet deployment failed');
      }
      
      logger.info(`Smart wallet deployment confirmed, tx: ${receipt.transactionHash}`);
      
      // Verify deployment was successful
      const verifyCode = await this.provider.getCode(walletAddress);
      if (verifyCode === '0x') {
        throw new Error('Smart wallet code not found after deployment');
      }
      
      // Wait for a short time to ensure state is updated on the blockchain
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      logger.info(`Smart wallet successfully deployed at ${walletAddress}`);
      return walletAddress;
    } catch (error) {
      logger.error('Error deploying wallet:', error);
      if (error.reason) logger.error('Error reason:', error.reason);
      if (error.code) logger.error('Error code:', error.code);
      if (error.body) logger.error('Error response body:', error.body);
      throw error;
    }
  }
  
  // Get current gas prices from the network
  async getCurrentGasPrices() {
    try {
      const feeData = await this.provider.getFeeData();
      
      logger.info("Current network gas prices:", {
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
      logger.error('Error fetching gas prices:', error);
      // Return default values if fetching fails
      return this.gasSettings;
    }
  }
}

module.exports = SmartWalletService;