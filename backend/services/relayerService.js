// backend/services/relayerService.js
const ethers = require('ethers');
const Poll = require('../artifacts/contracts/Poll.sol/Poll.json');
const PollFactory = require('../artifacts/contracts/PollFactory.sol/PollFactory.json');
const SmartWallet = require('../artifacts/contracts/SmartWalletFactory.sol/SmartWallet.json');
const IERC20 = require('../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json');
const logger = require('../utils/logger');
const { AuthorizationError } = require('../utils/errorTypes');

class RelayerService {
  constructor(provider, platformWalletProvider) {
    this.provider = provider;
    this.platformWalletProvider = platformWalletProvider;
    
    // Default gas settings for Polygon
    this.gasSettings = {
      maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei"),
      maxFeePerGas: ethers.utils.parseUnits("35", "gwei"),
      gasLimit: 3000000
    };

    // USDT token address from environment
    this.usdtAddress = process.env.USDT_ADDRESS;
    
    // Factory address from environment
    this.factoryAddress = process.env.FACTORY_ADDRESS;
  }
  
  /**
   * Verify a smart wallet transaction signature
   * @param {string} walletAddress - Smart wallet address
   * @param {string} targetAddress - Contract address to call
   * @param {string} callData - Encoded function call data
   * @param {string} signature - Signature to verify
   * @returns {Promise<{isValid: boolean, signer: string}>} Result with validation status and signer
   */
  async verifySmartWalletSignature(walletAddress, targetAddress, callData, signature) {
    try {
      logger.debug(`Verifying smart wallet signature for ${walletAddress}`);
      
      // Get smart wallet contract to check owner
      const smartWallet = new ethers.Contract(
        walletAddress,
        SmartWallet.abi,
        this.provider
      );
      
      let ownerAddress;
      try {
        ownerAddress = await smartWallet.owner();
        logger.debug(`Smart wallet owner: ${ownerAddress}`);
      } catch (error) {
        logger.error(`Error getting smart wallet owner: ${error.message}`);
        return { isValid: false, signer: null };
      }
      
      // Create message hash that would be signed
      const messageHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['address', 'uint256', 'bytes32'],
          [targetAddress, ethers.BigNumber.from(0), ethers.utils.keccak256(callData)]
        )
      );
      
      // Convert hash to EIP-191 message
      const message = ethers.utils.arrayify(messageHash);
      
      // Recover signer address from signature
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      logger.debug(`Recovered signer: ${recoveredAddress}`);
      
      // Compare to expected owner address
      const isValid = recoveredAddress.toLowerCase() === ownerAddress.toLowerCase();
      
      if (!isValid) {
        logger.warn(`Signature verification failed: ${recoveredAddress} ≠ ${ownerAddress}`);
      }
      
      return { isValid, signer: recoveredAddress };
    } catch (error) {
      logger.error(`Error verifying smart wallet signature: ${error.message}`);
      return { isValid: false, signer: null };
    }
  }
  
  /**
   * Verify a Magic user's EIP-712 signature for voting
   * @param {string} pollAddress - Poll contract address
   * @param {string} voterAddress - Voter's address
   * @param {number} optionIndex - Option index
   * @param {string} signature - Signature to verify
   * @returns {Promise<{isValid: boolean, signer: string}>} Result with validation status and signer
   */
  async verifyMagicVoteSignature(pollAddress, voterAddress, optionIndex, signature) {
    try {
      logger.debug(`Verifying Magic vote signature for ${voterAddress}`);
      
      // Get poll contract to fetch nonce
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      // Get user's nonce
      let nonce;
      try {
        nonce = await pollContract.getNonce(voterAddress);
        nonce = nonce.toNumber();
        logger.debug(`User nonce: ${nonce}`);
      } catch (error) {
        logger.error(`Error getting nonce: ${error.message}`);
        return { isValid: false, signer: null };
      }
      
      // Create domain data for EIP-712
      const domain = {
        name: 'TruthPoll',
        version: '1',
        chainId: 80002, // Polygon Amoy testnet
        verifyingContract: pollAddress
      };
      
      // Define types for EIP-712
      const types = {
        Vote: [
          { name: 'voter', type: 'address' },
          { name: 'option', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }
        ]
      };
      
      // Create value object
      const value = {
        voter: voterAddress,
        option: optionIndex,
        nonce: nonce
      };
      
      // Get the EIP-712 digest
      const typedData = {
        domain,
        types,
        value
      };
      
      // Using ethers._TypedDataEncoder directly
      const digest = ethers.utils._TypedDataEncoder.hash(
        domain,
        types,
        value
      );
      
      // Split signature into components
      const { v, r, s } = ethers.utils.splitSignature(signature);
      
      // Recover signer
      const recoveredAddress = ethers.utils.recoverAddress(digest, { v, r, s });
      logger.debug(`Recovered signer: ${recoveredAddress}`);
      
      // Compare to expected voter address
      const isValid = recoveredAddress.toLowerCase() === voterAddress.toLowerCase();
      
      if (!isValid) {
        logger.warn(`Signature verification failed: ${recoveredAddress} ≠ ${voterAddress}`);
      }
      
      return { isValid, signer: recoveredAddress };
    } catch (error) {
      logger.error(`Error verifying Magic vote signature: ${error.message}`);
      return { isValid: false, signer: null };
    }
  }
  
  // For Magic users - directly relay their signed transaction
  async relayMagicVote(pollAddress, voterAddress, optionIndex, signature) {
    try {
      logger.debug(`Relaying Magic vote: Poll=${pollAddress}, Voter=${voterAddress}, Option=${optionIndex}`);
      
      // SECURITY FIX: Verify signature server-side before proceeding
      const verificationResult = await this.verifyMagicVoteSignature(
        pollAddress,
        voterAddress,
        optionIndex,
        signature
      );
      
      if (!verificationResult.isValid) {
        throw new AuthorizationError('Invalid signature. Vote not authorized by the claimed address.');
      }
      
      logger.info(`Vote signature verified successfully for ${voterAddress}`);
      
      // Split signature into v, r, s
      const { v, r, s } = ethers.utils.splitSignature(signature);
      
      // Get signed contract via platform wallet provider
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'relay_magic_vote'
      );
      
      // Submit the meta-transaction
      const tx = await signedPoll.metaVote(
        voterAddress, 
        optionIndex, 
        v, r, s,
        this.gasSettings
      );
      
      logger.debug(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.debug(`Transaction confirmed: ${receipt.transactionHash}`);
      
      // Check if transaction succeeded
      if (receipt.status === 0) {
        logger.error('Transaction reverted on-chain');
        throw new Error('Transaction failed on-chain');
      }
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error relaying Magic vote:', error);
      throw error;
    }
  }
  
  // For non-Magic users with smart wallets
  async relaySmartWalletVote(smartWalletAddress, pollAddress, optionIndex, signature) {
    try {
      logger.debug(`Relaying Smart Wallet vote: Wallet=${smartWalletAddress}, Poll=${pollAddress}, Option=${optionIndex}`);
      
      // Verify the smart wallet is deployed
      const walletCode = await this.provider.getCode(smartWalletAddress);
      if (walletCode === '0x') {
        throw new Error(`Smart wallet at ${smartWalletAddress} is not deployed`);
      }
      
      // Encode the vote function call
      const pollInterface = new ethers.utils.Interface(Poll.abi);
      const callData = pollInterface.encodeFunctionData('vote', [optionIndex]);
      
      // SECURITY FIX: Verify signature server-side before proceeding
      const verificationResult = await this.verifySmartWalletSignature(
        smartWalletAddress,
        pollAddress,
        callData,
        signature
      );
      
      if (!verificationResult.isValid) {
        throw new AuthorizationError('Invalid signature. Transaction not authorized by wallet owner.');
      }
      
      logger.info(`Smart wallet signature verified successfully for ${smartWalletAddress}`);
      
      // Get Smart Wallet contract via platform wallet provider
      const smartWallet = await this.platformWalletProvider.getSignedContract(
        smartWalletAddress,
        SmartWallet.abi,
        'relay_smart_wallet_vote'
      );
      
      // Execute through the smart wallet
      const tx = await smartWallet.execute(
        pollAddress,      // target
        0,                // value
        callData,         // data
        signature,        // signature
        this.gasSettings  // gas settings
      );
      
      logger.debug(`Transaction submitted: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      logger.debug(`Transaction confirmed: ${receipt.transactionHash}`);
      
      // Check transaction status
      if (receipt.status === 0) {
        throw new Error('Smart wallet transaction reverted on-chain');
      }
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error relaying smart wallet vote:', error);
      throw error;
    }
  }
  
  /**
   * Relay a token approval transaction from a smart wallet
   * @param {string} smartWalletAddress - Smart wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {string} spenderAddress - Address to approve spending
   * @param {string} amount - Amount to approve
   * @param {string} signature - Transaction signature
   * @returns {Promise<{transactionHash: string, success: boolean}>} Transaction result
   */
  async relayTokenApproval(smartWalletAddress, tokenAddress, spenderAddress, amount, signature) {
    try {
      logger.debug(`Relaying token approval: Wallet=${smartWalletAddress}, Token=${tokenAddress}, Spender=${spenderAddress}, Amount=${amount}`);
      
      // Verify the smart wallet is deployed
      const walletCode = await this.provider.getCode(smartWalletAddress);
      if (walletCode === '0x') {
        throw new Error(`Smart wallet at ${smartWalletAddress} is not deployed`);
      }
      
      // Encode the approve function call
      const tokenInterface = new ethers.utils.Interface(IERC20.abi);
      const callData = tokenInterface.encodeFunctionData('approve', [spenderAddress, amount]);
      
      // Verify signature
      const verificationResult = await this.verifySmartWalletSignature(
        smartWalletAddress,
        tokenAddress,
        callData,
        signature
      );
      
      if (!verificationResult.isValid) {
        throw new AuthorizationError('Invalid signature. Token approval not authorized by wallet owner.');
      }
      
      logger.info(`Token approval signature verified for ${smartWalletAddress}`);
      
      // Get Smart Wallet contract via platform wallet provider
      const smartWallet = await this.platformWalletProvider.getSignedContract(
        smartWalletAddress,
        SmartWallet.abi,
        'relay_token_approval'
      );
      
      // Execute through the smart wallet
      const tx = await smartWallet.execute(
        tokenAddress,     // target
        0,                // value
        callData,         // data
        signature,        // signature
        this.gasSettings  // gas settings
      );
      
      logger.debug(`Approval transaction submitted: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      logger.debug(`Approval transaction confirmed: ${receipt.transactionHash}`);
      
      // Check transaction status
      if (receipt.status === 0) {
        throw new Error('Approval transaction reverted on-chain');
      }
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error relaying token approval:', error);
      throw error;
    }
  }
  
  /**
   * Relay a poll creation with funding transaction
   * @param {string} smartWalletAddress - Smart wallet address
   * @param {string} title - Poll title
   * @param {string[]} options - Poll options
   * @param {number} duration - Poll duration in seconds (0 for no end)
   * @param {string} rewardPerVoter - Reward per voter in USDT (wei format)
   * @param {string} fundAmount - Total fund amount in USDT (wei format)
   * @param {string} signature - Transaction signature
   * @returns {Promise<{transactionHash: string, pollAddress: string, success: boolean}>} Transaction result
   */
  async relayCreateAndFundPoll(smartWalletAddress, title, options, duration, rewardPerVoter, fundAmount, signature) {
    try {
      logger.debug(`Relaying poll creation with funding: Wallet=${smartWalletAddress}, Title=${title}, RewardPerVoter=${rewardPerVoter}, FundAmount=${fundAmount}`);
      
      // Verify the smart wallet is deployed
      const walletCode = await this.provider.getCode(smartWalletAddress);
      if (walletCode === '0x') {
        throw new Error(`Smart wallet at ${smartWalletAddress} is not deployed`);
      }
      
      // First, we need to verify that token approval is in place
      // Get token contract
      const tokenContract = new ethers.Contract(
        this.usdtAddress,
        IERC20.abi,
        this.provider
      );
      
      // Get factory contract
      const factoryContract = new ethers.Contract(
        this.factoryAddress,
        PollFactory.abi,
        this.provider
      );
      
      // Check allowance
      const allowance = await tokenContract.allowance(smartWalletAddress, this.factoryAddress);
      const fundAmountBN = ethers.BigNumber.from(fundAmount);
      
      // Calculate platform fee
      const platformFee = await factoryContract.calculatePlatformFee(fundAmountBN);
      const totalRequired = fundAmountBN.add(platformFee);
      
      if (allowance.lt(totalRequired)) {
        throw new Error(`Insufficient USDT allowance. Required: ${totalRequired.toString()}, Current: ${allowance.toString()}`);
      }
      
      // Check USDT balance
      const balance = await tokenContract.balanceOf(smartWalletAddress);
      if (balance.lt(totalRequired)) {
        throw new Error(`Insufficient USDT balance. Required: ${totalRequired.toString()}, Current: ${balance.toString()}`);
      }
      
      // Encode the createAndFundPoll function call
      const factoryInterface = new ethers.utils.Interface(PollFactory.abi);
      const callData = factoryInterface.encodeFunctionData('createAndFundPoll', [
        title,
        options,
        duration,
        rewardPerVoter,
        fundAmount
      ]);
      
      // Verify signature
      const verificationResult = await this.verifySmartWalletSignature(
        smartWalletAddress,
        this.factoryAddress,
        callData,
        signature
      );
      
      if (!verificationResult.isValid) {
        throw new AuthorizationError('Invalid signature. Poll creation not authorized by wallet owner.');
      }
      
      logger.info(`Poll creation signature verified for ${smartWalletAddress}`);
      
      // Get Smart Wallet contract via platform wallet provider
      const smartWallet = await this.platformWalletProvider.getSignedContract(
        smartWalletAddress,
        SmartWallet.abi,
        'relay_create_poll'
      );
      
      // Execute through the smart wallet
      const tx = await smartWallet.execute(
        this.factoryAddress, // target
        0,                   // value
        callData,            // data
        signature,           // signature
        {                    // gas settings
          ...this.gasSettings,
          gasLimit: 5000000  // Increase gas limit for poll creation
        }
      );
      
      logger.debug(`Poll creation transaction submitted: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      logger.debug(`Poll creation transaction confirmed: ${receipt.transactionHash}`);
      
      // Check transaction status
      if (receipt.status === 0) {
        throw new Error('Poll creation transaction reverted on-chain');
      }
      
      // Extract poll address from event
      let pollAddress = null;
      try {
        // Get PollCreatedAndFunded event
        const event = receipt.events.find(e => {
          if (!e.topics || e.topics.length === 0) return false;
          const eventTopic = factoryContract.interface.getEvent('PollCreatedAndFunded').topic;
          return e.topics[0] === eventTopic;
        });
        
        if (event) {
          const parsedLog = factoryContract.interface.parseLog(event);
          pollAddress = parsedLog.args.pollAddress;
          logger.info(`New poll created at address: ${pollAddress}`);
        } else {
          logger.warn('PollCreatedAndFunded event not found in transaction logs');
        }
      } catch (eventError) {
        logger.error('Error extracting poll address from event:', eventError);
      }
      
      return {
        transactionHash: receipt.transactionHash,
        pollAddress,
        success: true
      };
    } catch (error) {
      logger.error('Error relaying poll creation:', error);
      throw error;
    }
  }
  
  /**
   * Relay a transaction from a smart wallet to any target address
   * This method is used for general purpose transaction relaying, including token transfers
   * @param {string} smartWalletAddress - Smart wallet address
   * @param {string} targetAddress - Target contract address
   * @param {string} callData - Encoded function call data
   * @param {string} signature - Transaction signature
   * @param {string} value - Value to send with transaction (in wei)
   * @returns {Promise<{transactionHash: string, success: boolean}>} Transaction result
   */
  async relaySmartWalletTransaction(smartWalletAddress, targetAddress, callData, signature, value = "0") {
    try {
      logger.debug(`Relaying transaction from ${smartWalletAddress} to ${targetAddress}`);
      
      // Verify the smart wallet is deployed
      const walletCode = await this.provider.getCode(smartWalletAddress);
      if (walletCode === '0x') {
        throw new Error(`Smart wallet at ${smartWalletAddress} is not deployed`);
      }
      
      // Verify signature
      const verificationResult = await this.verifySmartWalletSignature(
        smartWalletAddress,
        targetAddress,
        callData,
        signature
      );
      
      if (!verificationResult.isValid) {
        throw new AuthorizationError('Invalid signature. Transaction not authorized by wallet owner.');
      }
      
      logger.info(`Smart wallet transaction signature verified for ${smartWalletAddress}`);
      
      // Get Smart Wallet contract via platform wallet provider
      const smartWallet = await this.platformWalletProvider.getSignedContract(
        smartWalletAddress,
        SmartWallet.abi,
        'relay_smart_wallet_transaction'
      );
      
      // Parse value to BigNumber
      const valueBN = ethers.BigNumber.from(value);
      
      // Execute through the smart wallet
      const tx = await smartWallet.execute(
        targetAddress,    // target
        valueBN,          // value
        callData,         // data
        signature,        // signature
        this.gasSettings  // gas settings
      );
      
      logger.debug(`Transaction submitted: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      logger.debug(`Transaction confirmed: ${receipt.transactionHash}`);
      
      // Check transaction status
      if (receipt.status === 0) {
        throw new Error('Smart wallet transaction reverted on-chain');
      }
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error relaying smart wallet transaction:', error);
      throw error;
    }
  }
  
  // Update gas settings - utility method
  async updateGasSettings() {
    try {
      const feeData = await this.provider.getFeeData();
      
      this.gasSettings = {
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.gt(ethers.utils.parseUnits("25", "gwei")) 
          ? feeData.maxPriorityFeePerGas 
          : ethers.utils.parseUnits("30", "gwei"),
        maxFeePerGas: feeData.maxFeePerGas.gt(ethers.utils.parseUnits("30", "gwei"))
          ? feeData.maxFeePerGas
          : ethers.utils.parseUnits("35", "gwei"),
        gasLimit: 3000000
      };
      
      logger.info("Updated gas settings:", {
        maxPriorityFeePerGas: ethers.utils.formatUnits(this.gasSettings.maxPriorityFeePerGas, "gwei") + " GWEI",
        maxFeePerGas: ethers.utils.formatUnits(this.gasSettings.maxFeePerGas, "gwei") + " GWEI",
        gasLimit: this.gasSettings.gasLimit
      });
      
      return this.gasSettings;
    } catch (error) {
      logger.error("Error updating gas settings:", error);
      return this.gasSettings;
    }
  }
}

module.exports = RelayerService;