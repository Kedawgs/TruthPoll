// backend/services/relayerService.js
const ethers = require('ethers');
const Poll = require('../artifacts/contracts/Poll.sol/Poll.json');
const SmartWallet = require('../artifacts/contracts/SmartWalletFactory.sol/SmartWallet.json');
const logger = require('../utils/logger');

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
  
  // For Magic users - directly relay their signed transaction
  async relayMagicVote(pollAddress, voterAddress, optionIndex, signature) {
    try {
      logger.debug(`====== ENHANCED DEBUGGING ======`);
      logger.debug(`Relaying Magic vote: Poll=${pollAddress}, Voter=${voterAddress}, Option=${optionIndex}`);
      logger.debug(`Signature length: ${signature?.length}`);
      
      // Get poll contract and check state before voting
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      // Check poll state to verify vote eligibility
      try {
        const isActive = await pollContract.isPollActive();
        const hasVoted = await pollContract.hasVoted(voterAddress);
        const ownerAddress = await pollContract.owner();
        const isCreator = ownerAddress.toLowerCase() === voterAddress.toLowerCase();
        const endTime = await pollContract.endTime();
        const options = await pollContract.getOptionsCount();
        
        logger.debug(`Pre-vote Poll State:`, {
          isActive, 
          hasVoted, 
          isCreator, 
          endTime: endTime.toNumber(), 
          currentTimestamp: Math.floor(Date.now() / 1000),
          optionsCount: options.toNumber(),
          requestedOption: optionIndex,
          validOption: optionIndex < options.toNumber()
        });
        
        // Common failure conditions
        if (isCreator) {
          logger.error('VOTE WILL FAIL: Poll creator cannot vote on their own poll');
        }
        if (hasVoted) {
          logger.error('VOTE WILL FAIL: User has already voted on this poll');
        }
        if (!isActive) {
          logger.error('VOTE WILL FAIL: Poll is not active');
        }
        if (optionIndex >= options.toNumber()) {
          logger.error('VOTE WILL FAIL: Invalid option index');
        }
      } catch (stateError) {
        logger.error('Error checking poll state:', stateError);
      }
      
      // Split signature into v, r, s
      const { v, r, s } = ethers.utils.splitSignature(signature);
      
      logger.debug(`Signature components:`, {
        v, 
        r: r.slice(0, 10) + '...', 
        s: s.slice(0, 10) + '...'
      });
      
      // Get user's nonce before transaction
      try {
        const nonce = await pollContract.getNonce(voterAddress);
        logger.debug(`User's current nonce: ${nonce.toNumber()}`);
      } catch (nonceError) {
        logger.error('Error fetching nonce:', nonceError);
      }
      
      // Print Transaction Params
      logger.debug('Transaction Params:', {
        pollAddress,
        voterAddress,
        optionIndex,
        v, r, s,
        gasSettingsType: this.gasSettings ? typeof this.gasSettings : 'undefined',
        maxPriorityFeePerGas: this.gasSettings?.maxPriorityFeePerGas?.toString(),
        maxFeePerGas: this.gasSettings?.maxFeePerGas?.toString(),
        gasLimit: this.gasSettings?.gasLimit?.toString()
      });
      
      // Get signed contract via platform wallet provider
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'relay_magic_vote'
      );
      
      // Submit the meta-transaction
      logger.debug(`Submitting transaction...`);
      const tx = await signedPoll.metaVote(
        voterAddress, 
        optionIndex, 
        v, r, s,
        this.gasSettings
      );
      
      logger.debug(`Transaction submitted: ${tx.hash}`);
      
      logger.debug(`Waiting for transaction confirmation...`);
      const receipt = await tx.wait();
      logger.debug(`Transaction confirmed: ${receipt.transactionHash}`);
      logger.debug(`Transaction status: ${receipt.status} (1=success, 0=failure)`);
      
      // Check if transaction succeeded
      if (receipt.status === 0) {
        logger.error('Transaction reverted on-chain despite no throw in JS');
        throw new Error('Transaction failed on-chain');
      }
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error relaying Magic vote:', error);
      // Enhanced error logging
      if (error.reason) logger.error('Error reason:', error.reason);
      if (error.code) logger.error('Error code:', error.code);
      if (error.receipt) logger.error('Transaction receipt status:', error.receipt.status);
      
      throw error;
    }
  }
  
  // For non-Magic users with smart wallets - IMPROVED IMPLEMENTATION
  async relaySmartWalletVote(smartWalletAddress, pollAddress, optionIndex, signature) {
    try {
      logger.debug(`====== ENHANCED SMART WALLET VOTE DEBUGGING ======`);
      logger.debug(`Relaying Smart Wallet vote: Wallet=${smartWalletAddress}, Poll=${pollAddress}, Option=${optionIndex}`);
      logger.debug(`Signature length: ${signature?.length}`);
      
      // Verify the smart wallet is deployed and has code
      const walletCode = await this.provider.getCode(smartWalletAddress);
      if (walletCode === '0x') {
        throw new Error(`Smart wallet at ${smartWalletAddress} is not deployed`);
      }
      logger.debug(`Smart wallet code verified, length: ${(walletCode.length - 2) / 2} bytes`);
      
      // Check poll state to verify vote eligibility
      try {
        const pollContract = new ethers.Contract(
          pollAddress,
          Poll.abi,
          this.provider
        );
        
        const isActive = await pollContract.isPollActive();
        const hasVoted = await pollContract.hasVoted(smartWalletAddress);
        const ownerAddress = await pollContract.owner();
        const isCreator = ownerAddress.toLowerCase() === smartWalletAddress.toLowerCase();
        const options = await pollContract.getOptionsCount();
        
        logger.debug(`Pre-vote Poll State:`, {
          isActive, 
          hasVoted, 
          isCreator,
          optionsCount: options.toNumber(),
          requestedOption: optionIndex,
          validOption: optionIndex < options.toNumber()
        });
        
        // Warn about potential failure conditions
        if (isCreator) {
          logger.error('VOTE WILL FAIL: Smart wallet is the poll creator');
        }
        if (hasVoted) {
          logger.error('VOTE WILL FAIL: Smart wallet has already voted on this poll');
        }
        if (!isActive) {
          logger.error('VOTE WILL FAIL: Poll is not active');
        }
        if (optionIndex >= options.toNumber()) {
          logger.error('VOTE WILL FAIL: Invalid option index');
        }
      } catch (stateError) {
        logger.error('Error checking poll state:', stateError);
      }
      
      // Get Smart Wallet contract via platform wallet provider
      const smartWallet = await this.platformWalletProvider.getSignedContract(
        smartWalletAddress,
        SmartWallet.abi,
        'relay_smart_wallet_vote'
      );
      
      // Verify the smart wallet's owner
      try {
        const owner = await smartWallet.owner();
        logger.debug(`Smart wallet owner: ${owner}`);
      } catch (ownerError) {
        logger.error('Error getting smart wallet owner:', ownerError);
      }
      
      // Encode the vote function call
      const pollInterface = new ethers.utils.Interface(Poll.abi);
      const callData = pollInterface.encodeFunctionData('vote', [optionIndex]);
      
      logger.debug(`Call data encoded: ${callData}`);
      
      // Execute transaction params
      const executeParams = {
        target: pollAddress,
        value: 0,
        callData,
        signature
      };
      
      logger.debug('Execute parameters:', {
        target: executeParams.target,
        value: executeParams.value,
        callDataLength: executeParams.callData.length,
        signatureLength: executeParams.signature.length
      });
      
      // Execute through the smart wallet
      logger.debug(`Submitting transaction to smart wallet...`);
      const tx = await smartWallet.execute(
        pollAddress,      // target
        0,                // value
        callData,         // data
        signature,        // signature
        this.gasSettings  // gas settings
      );
      
      logger.debug(`Transaction submitted: ${tx.hash}`);
      
      // Wait for transaction confirmation with timeout
      logger.debug('Waiting for transaction confirmation...');
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000)
        )
      ]);
      
      logger.debug(`Transaction confirmed: ${receipt.transactionHash}`);
      logger.debug(`Transaction status: ${receipt.status} (1=success, 0=failure)`);
      
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
      // Enhanced error logging
      if (error.reason) logger.error('Error reason:', error.reason);
      if (error.code) logger.error('Error code:', error.code);
      if (error.receipt) logger.error('Transaction receipt status:', error.receipt?.status);
      
      throw error;
    }
  }
  
  // Claim reward for Magic users
  async relayMagicRewardClaim(pollAddress, claimerAddress, signature) {
    try {
      logger.info(`Relaying Magic reward claim: Poll=${pollAddress}, Claimer=${claimerAddress}`);
      
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
      
      // Get Smart Wallet contract
      const smartWallet = await this.platformWalletProvider.getSignedContract(
        smartWalletAddress,
        SmartWallet.abi,
        'relay_smart_wallet_reward_claim'
      );
      
      // Encode the claimReward function call
      const pollInterface = new ethers.utils.Interface(Poll.abi);
      const callData = pollInterface.encodeFunctionData('claimReward', []);
      
      logger.info(`Claim reward calldata: ${callData}`);
      
      // Check eligibility before trying to claim
      try {
        const pollContract = new ethers.Contract(
          pollAddress,
          Poll.abi,
          this.provider
        );
        
        const canClaim = await pollContract.canClaimReward(smartWalletAddress);
        logger.info(`Can claim reward? ${canClaim}`);
        
        if (!canClaim) {
          const hasVoted = await pollContract.hasVoted(smartWalletAddress);
          const hasClaimedReward = false; // We'd need to check this on the contract
          const isActive = await pollContract.isPollActive();
          
          logger.info('Claim eligibility factors:', {
            hasVoted,
            hasClaimedReward,
            isActive
          });
        }
      } catch (checkError) {
        logger.error('Error checking claim eligibility:', checkError);
      }
      
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
      logger.info(`Transaction status: ${receipt.status}`);
      
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
  
  // Fund poll with USDT rewards via smart wallet
  async relaySmartWalletFundRewards(smartWalletAddress, pollAddress, amount, signature) {
    try {
      logger.info(`Relaying Smart Wallet fund rewards: Wallet=${smartWalletAddress}, Poll=${pollAddress}, Amount=${amount}`);
      
      // Get Smart Wallet contract
      const smartWallet = await this.platformWalletProvider.getSignedContract(
        smartWalletAddress,
        SmartWallet.abi,
        'relay_smart_wallet_fund_rewards'
      );
      
      // Encode the fundRewards function call
      const pollInterface = new ethers.utils.Interface(Poll.abi);
      const callData = pollInterface.encodeFunctionData('fundRewards', [amount]);
      
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
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error relaying smart wallet fund rewards:', error);
      throw error;
    }
  }
  
  // Try direct vote (bypass meta transaction for testing)
  async directVote(pollAddress, optionIndex) {
    try {
      logger.info(`====== DIRECT VOTE TESTING WITH FULL DIAGNOSTICS ======`);
      logger.info(`Directly voting on poll: Poll=${pollAddress}, Option=${optionIndex}`);
      
      // Get poll contract
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      // Get platform signer
      const signer = await this.platformWalletProvider.getSigner('direct_vote_test');
      const signedPoll = pollContract.connect(signer);
      
      // Platform wallet address
      const platformWalletAddress = await this.platformWalletProvider.getAddress();
      logger.info(`Platform wallet address: ${platformWalletAddress}`);
      
      // Check all possible vote restrictions
      const ownerAddress = await pollContract.owner();
      logger.info(`Poll owner address: ${ownerAddress}`);
      
      const isCreator = ownerAddress.toLowerCase() === platformWalletAddress.toLowerCase();
      logger.info(`Is platform wallet the poll creator? ${isCreator}`);
      
      const hasVoted = await pollContract.hasVoted(platformWalletAddress);
      logger.info(`Has platform wallet already voted? ${hasVoted}`);
      
      const isActive = await pollContract.isPollActive();
      logger.info(`Is poll active? ${isActive}`);
      
      const endTime = await pollContract.endTime();
      logger.info(`Poll end time: ${endTime} (0 means no end time)`);
      
      const currentTime = Math.floor(Date.now() / 1000);
      logger.info(`Current time: ${currentTime}`);
      
      const hasEnded = endTime.toNumber() > 0 && currentTime >= endTime.toNumber();
      logger.info(`Has poll ended? ${hasEnded}`);
      
      const optionsCount = await pollContract.getOptionsCount();
      logger.info(`Total options: ${optionsCount}`);
      
      const isValidOption = optionIndex < optionsCount;
      logger.info(`Is option index valid? ${isValidOption}`);
      
      // Log expected result
      if (isCreator) {
        logger.info("VOTE WILL FAIL: Platform wallet is the poll creator");
      } else if (hasVoted) {
        logger.info("VOTE WILL FAIL: Platform wallet has already voted");
      } else if (!isActive) {
        logger.info("VOTE WILL FAIL: Poll is not active");
      } else if (hasEnded) {
        logger.info("VOTE WILL FAIL: Poll has ended");
      } else if (!isValidOption) {
        logger.info("VOTE WILL FAIL: Invalid option index");
      } else {
        logger.info("Vote should succeed - no obvious restrictions detected");
      }
      
      // Try to vote anyway
      logger.info(`Submitting vote transaction...`);
      const tx = await signedPoll.vote(optionIndex, this.gasSettings);
      
      logger.info(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Transaction confirmed: ${receipt.transactionHash}`);
      logger.info(`Transaction status: ${receipt.status} (1=success, 0=failure)`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: receipt.status === 1,
        platformAddress: platformWalletAddress
      };
    } catch (error) {
      logger.error('Error in direct vote process:', error);
      // Try to determine exact failure reason from error message
      let failureReason = "Unknown - See full error above";
      
      const errorStr = error.toString();
      if (errorStr.includes("Poll creator cannot vote")) {
        failureReason = "Platform wallet is the poll creator";
      } else if (errorStr.includes("Already voted")) {
        failureReason = "Platform wallet has already voted";
      } else if (errorStr.includes("Poll is not active")) {
        failureReason = "Poll is not active";
      } else if (errorStr.includes("Poll has ended")) {
        failureReason = "Poll has ended";
      } else if (errorStr.includes("Invalid option")) {
        failureReason = "Invalid option index";
      }
      
      logger.info("FAILURE REASON:", failureReason);
      if (error.reason) logger.error("Error reason:", error.reason);
      if (error.code) logger.error("Error code:", error.code);
      if (error.receipt) logger.error("Transaction receipt status:", error.receipt.status);
      
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