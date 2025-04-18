// backend/services/smartWalletService.js
const ethers = require('ethers');
const SmartWalletFactory = require('../artifacts/contracts/SmartWalletFactory.sol/SmartWalletFactory.json');
const TestUSDT = require('../artifacts/contracts/TestUSDT.sol/TestUSDT.json');
const logger = require('../utils/logger');

class SmartWalletService {
  constructor(provider, platformWalletProvider) {
    this.provider = provider;
    this.platformWalletProvider = platformWalletProvider;
    this.factoryAddress = process.env.SMART_WALLET_FACTORY_ADDRESS;
    this.usdtAddress = process.env.USDT_ADDRESS;
    
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

    if (this.usdtAddress) {
      this.usdtContract = new ethers.Contract(
        this.usdtAddress,
        TestUSDT.abi,
        this.provider
      );
      logger.info(`USDT contract initialized at ${this.usdtAddress}`);
    } else {
      logger.warn('USDT address not set in environment variables');
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

  // NEW: Get USDT balance for a wallet address
  async getUSDTBalance(walletAddress) {
    try {
      if (!this.usdtContract) {
        throw new Error('USDT contract not initialized');
      }

      const balance = await this.usdtContract.balanceOf(walletAddress);
      // USDT uses 6 decimals
      const formattedBalance = ethers.utils.formatUnits(balance, 6);
      
      logger.info(`USDT balance for ${walletAddress}: ${formattedBalance}`);
      return formattedBalance;
    } catch (error) {
      logger.error(`Error getting USDT balance for ${walletAddress}:`, error);
      throw error;
    }
  }

  // NEW: Check if wallet has enough USDT for an operation
  async hasEnoughUSDT(walletAddress, amount) {
    try {
      const balance = await this.getUSDTBalance(walletAddress);
      const hasEnough = parseFloat(balance) >= parseFloat(amount);
      
      logger.info(`Wallet ${walletAddress} has ${balance} USDT. Required: ${amount}. Sufficient: ${hasEnough}`);
      return hasEnough;
    } catch (error) {
      logger.error(`Error checking if wallet has enough USDT:`, error);
      return false;
    }
  }

  // NEW: Create USDT approval transaction for relayer
  async createUSDTApprovalTransaction(ownerAddress, spenderAddress, amount) {
    try {
      if (!this.usdtContract) {
        throw new Error('USDT contract not initialized');
      }
      
      // Get smart wallet address for the owner
      const smartWalletAddress = await this.getWalletAddress(ownerAddress);
      
      // Check if smart wallet is deployed
      const isDeployed = await this.isWalletDeployed(smartWalletAddress);
      if (!isDeployed) {
        throw new Error('Smart wallet not deployed. Deploy it first before approving USDT.');
      }
      
      // Parse amount to wei
      const amountWei = ethers.utils.parseUnits(amount.toString(), 6); // USDT uses 6 decimals
      
      // Encode the approve function call
      const usdtInterface = new ethers.utils.Interface(TestUSDT.abi);
      const callData = usdtInterface.encodeFunctionData('approve', [spenderAddress, amountWei]);
      
      logger.info(`Created USDT approval transaction from ${smartWalletAddress} to approve ${amount} USDT for ${spenderAddress}`);
      
      return {
        smartWalletAddress,
        targetAddress: this.usdtAddress,
        callData,
        amount: amountWei.toString()
      };
    } catch (error) {
      logger.error('Error creating USDT approval transaction:', error);
      throw error;
    }
  }

  // NEW: Create USDT transfer transaction for relayer
  async createUSDTTransferTransaction(ownerAddress, recipientAddress, amount) {
    try {
      if (!this.usdtContract) {
        throw new Error('USDT contract not initialized');
      }
      
      // Get smart wallet address for the owner
      const smartWalletAddress = await this.getWalletAddress(ownerAddress);
      
      // Check if smart wallet is deployed
      const isDeployed = await this.isWalletDeployed(smartWalletAddress);
      if (!isDeployed) {
        throw new Error('Smart wallet not deployed. Deploy it first before transferring USDT.');
      }
      
      // Parse amount to wei
      const amountWei = ethers.utils.parseUnits(amount.toString(), 6); // USDT uses 6 decimals
      
      // Encode the transfer function call
      const usdtInterface = new ethers.utils.Interface(TestUSDT.abi);
      const callData = usdtInterface.encodeFunctionData('transfer', [recipientAddress, amountWei]);
      
      logger.info(`Created USDT transfer transaction from ${smartWalletAddress} to send ${amount} USDT to ${recipientAddress}`);
      
      return {
        smartWalletAddress,
        targetAddress: this.usdtAddress,
        callData,
        amount: amountWei.toString()
      };
    } catch (error) {
      logger.error('Error creating USDT transfer transaction:', error);
      throw error;
    }
  }

  // NEW: Calculate platform fee for a USDT amount
  async calculatePlatformFee(amount, feePercentage = 6) {
    try {
      // Default platform fee is 6% if not provided
      const fee = (parseFloat(amount) * feePercentage) / 100;
      return fee.toFixed(6); // Use 6 decimal places for USDT
    } catch (error) {
      logger.error('Error calculating platform fee:', error);
      throw error;
    }
  }

  // NEW: Create poll funding transaction
  async createPollFundingTransaction(ownerAddress, pollFactoryAddress, title, options, duration, rewardPerVoter, fundAmount) {
    try {
      if (!this.usdtContract) {
        throw new Error('USDT contract not initialized');
      }
      
      // Get smart wallet address for the owner
      const smartWalletAddress = await this.getWalletAddress(ownerAddress);
      
      // Check if smart wallet is deployed
      const isDeployed = await this.isWalletDeployed(smartWalletAddress);
      if (!isDeployed) {
        throw new Error('Smart wallet not deployed. Deploy it first before funding a poll.');
      }
      
      // Parse amounts to wei
      const rewardPerVoterWei = ethers.utils.parseUnits(rewardPerVoter.toString(), 6); // USDT uses 6 decimals
      const fundAmountWei = ethers.utils.parseUnits(fundAmount.toString(), 6); // USDT uses 6 decimals
      
      // Calculate platform fee
      const platformFeePercent = 600; // 6.00%
      const platformFeeWei = fundAmountWei.mul(platformFeePercent).div(10000);
      const totalAmountWei = fundAmountWei.add(platformFeeWei);
      
      // Get Poll Factory interface
      const pollFactoryInterface = new ethers.utils.Interface([
        "function createAndFundPoll(string memory _title, string[] memory _options, uint256 _duration, uint256 _rewardPerVoter, uint256 _fundAmount) external returns (address)"
      ]);
      
      // Encode the createAndFundPoll function call
      const callData = pollFactoryInterface.encodeFunctionData('createAndFundPoll', [
        title,
        options,
        ethers.BigNumber.from(duration),
        rewardPerVoterWei,
        fundAmountWei
      ]);
      
      logger.info(`Created poll funding transaction for "${title}" with ${fundAmount} USDT of rewards and ${ethers.utils.formatUnits(platformFeeWei, 6)} USDT platform fee`);
      
      // First, we need to approve the factory to spend our USDT
      const approvalTx = await this.createUSDTApprovalTransaction(
        ownerAddress,
        pollFactoryAddress,
        ethers.utils.formatUnits(totalAmountWei, 6)
      );
      
      return {
        approvalTransaction: approvalTx,
        createPollTransaction: {
          smartWalletAddress,
          targetAddress: pollFactoryAddress,
          callData,
          amount: "0" // No ETH value sent with this call
        },
        totalAmount: ethers.utils.formatUnits(totalAmountWei, 6),
        platformFee: ethers.utils.formatUnits(platformFeeWei, 6),
        pollFunding: fundAmount
      };
    } catch (error) {
      logger.error('Error creating poll funding transaction:', error);
      throw error;
    }
  }
}

module.exports = SmartWalletService;