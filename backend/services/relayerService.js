// backend/services/relayerService.js
const ethers = require('ethers');
const Poll = require('../artifacts/contracts/Poll.sol/Poll.json');
const SmartWallet = require('../artifacts/contracts/SmartWalletFactory.sol/SmartWallet.json');
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
  
  /**
   * Verify a Magic user's signature for reward claim
   * @param {string} pollAddress - Poll contract address
   * @param {string} claimerAddress - Claimer's address
   * @param {string} signature - Signature to verify
   * @returns {Promise<{isValid: boolean, signer: string}>} Result with validation status and signer
   */
  async verifyMagicClaimSignature(pollAddress, claimerAddress, signature) {
    try {
      logger.debug(`Verifying Magic claim signature for ${claimerAddress}`);
      
      // Get poll contract to fetch nonce
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      // Get user's nonce
      let nonce;
      try {
        nonce = await pollContract.getNonce(claimerAddress);
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
        ClaimReward: [
          { name: 'claimer', type: 'address' },
          { name: 'nonce', type: 'uint256' }
        ]
      };
      
      // Create value object
      const value = {
        claimer: claimerAddress,
        nonce: nonce
      };
      
      // Get the EIP-712 digest
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
      
      // Compare to expected claimer address
      const isValid = recoveredAddress.toLowerCase() === claimerAddress.toLowerCase();
      
      if (!isValid) {
        logger.warn(`Signature verification failed: ${recoveredAddress} ≠ ${claimerAddress}`);
      }
      
      return { isValid, signer: recoveredAddress };
    } catch (error) {
      logger.error(`Error verifying Magic claim signature: ${error.message}`);
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
      
      // Execute transaction params
      const executeParams = {
        target: pollAddress,
        value: 0,
        callData,
        signature
      };
      
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
  
  // Claim reward for Magic users
  async relayMagicRewardClaim(pollAddress, claimerAddress, signature) {
    try {
      logger.info(`Relaying Magic reward claim: Poll=${pollAddress}, Claimer=${claimerAddress}`);
      
      // SECURITY FIX: Verify signature server-side before proceeding
      const verificationResult = await this.verifyMagicClaimSignature(
        pollAddress,
        claimerAddress,
        signature
      );
      
      if (!verificationResult.isValid) {
        throw new AuthorizationError('Invalid signature. Claim not authorized by the claimed address.');
      }
      
      logger.info(`Claim signature verified successfully for ${claimerAddress}`);
      
      // Split signature into v, r, s
      const { v, r, s } = ethers.utils.splitSignature(signature);
      
      // Get signed poll contract
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'relay_magic_reward_claim'
      );
      
      // Submit the meta-transaction
      const tx = await signedPoll.metaClaimReward(
        claimerAddress, 
        v, r, s,
        this.gasSettings
      );
      
      logger.info(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Transaction confirmed: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error relaying Magic reward claim:', error);
      throw error;
    }
  }
  
  // Claim reward through smart wallet
  async relaySmartWalletRewardClaim(smartWalletAddress, pollAddress, signature) {
    try {
      logger.info(`Relaying Smart Wallet reward claim: Wallet=${smartWalletAddress}, Poll=${pollAddress}`);
      
      // Verify the smart wallet is deployed
      const walletCode = await this.provider.getCode(smartWalletAddress);
      if (walletCode === '0x') {
        throw new Error(`Smart wallet at ${smartWalletAddress} is not deployed`);
      }
      
      // Encode the claimReward function call
      const pollInterface = new ethers.utils.Interface(Poll.abi);
      const callData = pollInterface.encodeFunctionData('claimReward', []);
      
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
      
      // Get Smart Wallet contract
      const smartWallet = await this.platformWalletProvider.getSignedContract(
        smartWalletAddress,
        SmartWallet.abi,
        'relay_smart_wallet_reward_claim'
      );
      
      // Execute through the smart wallet
      const tx = await smartWallet.execute(
        pollAddress,
        0, // No value
        callData,
        signature,
        this.gasSettings
      );
      
      logger.info(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Transaction confirmed: ${receipt.transactionHash}`);
      
      if (receipt.status === 0) {
        throw new Error('Smart wallet transaction reverted on-chain');
      }
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error relaying smart wallet reward claim:', error);
      throw error;
    }
  }
  
  // Rest of the existing methods...
  
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