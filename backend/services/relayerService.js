// backend/services/relayerService.js
const ethers = require('ethers');
const Poll = require('../artifacts/contracts/Poll.sol/Poll.json');
const SmartWallet = require('../artifacts/contracts/SmartWalletFactory.sol/SmartWallet.json');

class RelayerService {
  constructor(provider, platformPrivateKey) {
    this.provider = provider;
    this.platformWallet = new ethers.Wallet(platformPrivateKey, provider);
    
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
      console.log(`====== ENHANCED DEBUGGING ======`);
      console.log(`Relaying Magic vote: Poll=${pollAddress}, Voter=${voterAddress}, Option=${optionIndex}`);
      console.log(`Signature length: ${signature?.length}`);
      
      // Get poll contract and check state before voting
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.platformWallet
      );
      
      // Check poll state to verify vote eligibility
      try {
        const isActive = await pollContract.isPollActive();
        const hasVoted = await pollContract.hasVoted(voterAddress);
        const ownerAddress = await pollContract.owner();
        const isCreator = ownerAddress.toLowerCase() === voterAddress.toLowerCase();
        const endTime = await pollContract.endTime();
        const options = await pollContract.getOptionsCount();
        
        console.log(`Pre-vote Poll State:`, {
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
          console.error('VOTE WILL FAIL: Poll creator cannot vote on their own poll');
        }
        if (hasVoted) {
          console.error('VOTE WILL FAIL: User has already voted on this poll');
        }
        if (!isActive) {
          console.error('VOTE WILL FAIL: Poll is not active');
        }
        if (optionIndex >= options.toNumber()) {
          console.error('VOTE WILL FAIL: Invalid option index');
        }
      } catch (stateError) {
        console.error('Error checking poll state:', stateError);
      }
      
      // Split signature into v, r, s
      const { v, r, s } = ethers.utils.splitSignature(signature);
      
      console.log(`Signature components:`, {
        v, 
        r: r.slice(0, 10) + '...', 
        s: s.slice(0, 10) + '...'
      });
      
      // Get user's nonce before transaction
      try {
        const nonce = await pollContract.getNonce(voterAddress);
        console.log(`User's current nonce: ${nonce.toNumber()}`);
      } catch (nonceError) {
        console.error('Error fetching nonce:', nonceError);
      }
      
      // Print Transaction Params
      console.log('Transaction Params:', {
        pollAddress,
        voterAddress,
        optionIndex,
        v, r, s,
        gasSettingsType: this.gasSettings ? typeof this.gasSettings : 'undefined',
        maxPriorityFeePerGas: this.gasSettings?.maxPriorityFeePerGas?.toString(),
        maxFeePerGas: this.gasSettings?.maxFeePerGas?.toString(),
        gasLimit: this.gasSettings?.gasLimit?.toString()
      });
      
      // Submit the meta-transaction
      console.log(`Submitting transaction...`);
      const tx = await pollContract.metaVote(
        voterAddress, 
        optionIndex, 
        v, r, s,
        this.gasSettings
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      console.log(`Waiting for transaction confirmation...`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed: ${receipt.transactionHash}`);
      console.log(`Transaction status: ${receipt.status} (1=success, 0=failure)`);
      
      // Check if transaction succeeded
      if (receipt.status === 0) {
        console.error('Transaction reverted on-chain despite no throw in JS');
        throw new Error('Transaction failed on-chain');
      }
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      console.error('Error relaying Magic vote:', error);
      // Enhanced error logging
      if (error.reason) console.error('Error reason:', error.reason);
      if (error.code) console.error('Error code:', error.code);
      if (error.receipt) console.error('Transaction receipt status:', error.receipt.status);
      
      throw error;
    }
  }
  
  // For non-Magic users with smart wallets - IMPROVED IMPLEMENTATION
  async relaySmartWalletVote(smartWalletAddress, pollAddress, optionIndex, signature) {
    try {
      console.log(`====== ENHANCED SMART WALLET VOTE DEBUGGING ======`);
      console.log(`Relaying Smart Wallet vote: Wallet=${smartWalletAddress}, Poll=${pollAddress}, Option=${optionIndex}`);
      console.log(`Signature length: ${signature?.length}`);
      
      // Verify the smart wallet is deployed and has code
      const walletCode = await this.provider.getCode(smartWalletAddress);
      if (walletCode === '0x') {
        throw new Error(`Smart wallet at ${smartWalletAddress} is not deployed`);
      }
      console.log(`Smart wallet code verified, length: ${(walletCode.length - 2) / 2} bytes`);
      
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
        
        console.log(`Pre-vote Poll State:`, {
          isActive, 
          hasVoted, 
          isCreator,
          optionsCount: options.toNumber(),
          requestedOption: optionIndex,
          validOption: optionIndex < options.toNumber()
        });
        
        // Warn about potential failure conditions
        if (isCreator) {
          console.error('VOTE WILL FAIL: Smart wallet is the poll creator');
        }
        if (hasVoted) {
          console.error('VOTE WILL FAIL: Smart wallet has already voted on this poll');
        }
        if (!isActive) {
          console.error('VOTE WILL FAIL: Poll is not active');
        }
        if (optionIndex >= options.toNumber()) {
          console.error('VOTE WILL FAIL: Invalid option index');
        }
      } catch (stateError) {
        console.error('Error checking poll state:', stateError);
      }
      
      // Get Smart Wallet contract
      const smartWallet = new ethers.Contract(
        smartWalletAddress,
        SmartWallet.abi,
        this.platformWallet
      );
      
      // Verify the smart wallet's owner
      try {
        const owner = await smartWallet.owner();
        console.log(`Smart wallet owner: ${owner}`);
      } catch (ownerError) {
        console.error('Error getting smart wallet owner:', ownerError);
      }
      
      // Encode the vote function call
      const pollInterface = new ethers.utils.Interface(Poll.abi);
      const callData = pollInterface.encodeFunctionData('vote', [optionIndex]);
      
      console.log(`Call data encoded: ${callData}`);
      
      // Parse signature
      let sigComponents;
      try {
        sigComponents = ethers.utils.splitSignature(signature);
        console.log(`Signature components:`, {
          v: sigComponents.v,
          r: sigComponents.r.slice(0, 10) + '...',
          s: sigComponents.s.slice(0, 10) + '...'
        });
      } catch (sigError) {
        console.error('Error parsing signature:', sigError);
        throw new Error('Invalid signature format');
      }
      
      // Execute transaction params
      const executeParams = {
        target: pollAddress,
        value: 0,
        callData,
        signature
      };
      
      console.log('Execute parameters:', {
        target: executeParams.target,
        value: executeParams.value,
        callDataLength: executeParams.callData.length,
        signatureLength: executeParams.signature.length
      });
      
      // Execute through the smart wallet
      console.log(`Submitting transaction to smart wallet...`);
      const tx = await smartWallet.execute(
        pollAddress,      // target
        0,                // value
        callData,         // data
        signature,        // signature
        this.gasSettings  // gas settings
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      // Wait for transaction confirmation with timeout
      console.log('Waiting for transaction confirmation...');
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000)
        )
      ]);
      
      console.log(`Transaction confirmed: ${receipt.transactionHash}`);
      console.log(`Transaction status: ${receipt.status} (1=success, 0=failure)`);
      
      // Check transaction status
      if (receipt.status === 0) {
        throw new Error('Smart wallet transaction reverted on-chain');
      }
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      console.error('Error relaying smart wallet vote:', error);
      // Enhanced error logging
      if (error.reason) console.error('Error reason:', error.reason);
      if (error.code) console.error('Error code:', error.code);
      if (error.receipt) console.error('Transaction receipt status:', error.receipt?.status);
      
      throw error;
    }
  }
  
  // Claim reward for Magic users
  async relayMagicRewardClaim(pollAddress, claimerAddress, signature) {
    try {
      console.log(`Relaying Magic reward claim: Poll=${pollAddress}, Claimer=${claimerAddress}`);
      
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.platformWallet
      );
      
      // Split signature into v, r, s
      const { v, r, s } = ethers.utils.splitSignature(signature);
      
      // Submit the meta-transaction
      const tx = await pollContract.metaClaimReward(
        claimerAddress, 
        v, r, s,
        this.gasSettings
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      console.error('Error relaying Magic reward claim:', error);
      throw error;
    }
  }
  
  // Claim reward through smart wallet - IMPROVED IMPLEMENTATION
  async relaySmartWalletRewardClaim(smartWalletAddress, pollAddress, signature) {
    try {
      console.log(`Relaying Smart Wallet reward claim: Wallet=${smartWalletAddress}, Poll=${pollAddress}`);
      
      // Verify the smart wallet is deployed
      const walletCode = await this.provider.getCode(smartWalletAddress);
      if (walletCode === '0x') {
        throw new Error(`Smart wallet at ${smartWalletAddress} is not deployed`);
      }
      
      // Get Smart Wallet contract
      const smartWallet = new ethers.Contract(
        smartWalletAddress,
        SmartWallet.abi,
        this.platformWallet
      );
      
      // Encode the claimReward function call
      const pollInterface = new ethers.utils.Interface(Poll.abi);
      const callData = pollInterface.encodeFunctionData('claimReward', []);
      
      console.log(`Claim reward calldata: ${callData}`);
      
      // Check eligibility before trying to claim
      try {
        const pollContract = new ethers.Contract(
          pollAddress,
          Poll.abi,
          this.provider
        );
        
        const canClaim = await pollContract.canClaimReward(smartWalletAddress);
        console.log(`Can claim reward? ${canClaim}`);
        
        if (!canClaim) {
          const hasVoted = await pollContract.hasVoted(smartWalletAddress);
          const hasClaimedReward = false; // We'd need to check this on the contract
          const isActive = await pollContract.isPollActive();
          
          console.log('Claim eligibility factors:', {
            hasVoted,
            hasClaimedReward,
            isActive
          });
        }
      } catch (checkError) {
        console.error('Error checking claim eligibility:', checkError);
      }
      
      // Execute through the smart wallet
      const tx = await smartWallet.execute(
        pollAddress,
        0, // No value
        callData,
        signature,
        this.gasSettings
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed: ${receipt.transactionHash}`);
      console.log(`Transaction status: ${receipt.status}`);
      
      if (receipt.status === 0) {
        throw new Error('Smart wallet transaction reverted on-chain');
      }
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      console.error('Error relaying smart wallet reward claim:', error);
      throw error;
    }
  }
  
  // Fund poll with USDT rewards via smart wallet
  async relaySmartWalletFundRewards(smartWalletAddress, pollAddress, amount, signature) {
    try {
      console.log(`Relaying Smart Wallet fund rewards: Wallet=${smartWalletAddress}, Poll=${pollAddress}, Amount=${amount}`);
      
      // Get Smart Wallet contract
      const smartWallet = new ethers.Contract(
        smartWalletAddress,
        SmartWallet.abi,
        this.platformWallet
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
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      console.error('Error relaying smart wallet fund rewards:', error);
      throw error;
    }
  }
  
  // Try direct vote (bypass meta transaction for testing)
  // Enhanced directVote with more debugging
  async directVote(pollAddress, optionIndex) {
    try {
      console.log(`====== DIRECT VOTE TESTING WITH FULL DIAGNOSTICS ======`);
      console.log(`Directly voting on poll: Poll=${pollAddress}, Option=${optionIndex}`);
      
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.platformWallet
      );
      
      // Check all possible vote restrictions
      const platformWalletAddress = this.platformWallet.address;
      console.log(`Platform wallet address: ${platformWalletAddress}`);
      
      const ownerAddress = await pollContract.owner();
      console.log(`Poll owner address: ${ownerAddress}`);
      
      const isCreator = ownerAddress.toLowerCase() === platformWalletAddress.toLowerCase();
      console.log(`Is platform wallet the poll creator? ${isCreator}`);
      
      const hasVoted = await pollContract.hasVoted(platformWalletAddress);
      console.log(`Has platform wallet already voted? ${hasVoted}`);
      
      const isActive = await pollContract.isPollActive();
      console.log(`Is poll active? ${isActive}`);
      
      const endTime = await pollContract.endTime();
      console.log(`Poll end time: ${endTime} (0 means no end time)`);
      
      const currentTime = Math.floor(Date.now() / 1000);
      console.log(`Current time: ${currentTime}`);
      
      const hasEnded = endTime.toNumber() > 0 && currentTime >= endTime.toNumber();
      console.log(`Has poll ended? ${hasEnded}`);
      
      const optionsCount = await pollContract.getOptionsCount();
      console.log(`Total options: ${optionsCount}`);
      
      const isValidOption = optionIndex < optionsCount;
      console.log(`Is option index valid? ${isValidOption}`);
      
      // Log expected result
      if (isCreator) {
        console.log("VOTE WILL FAIL: Platform wallet is the poll creator");
      } else if (hasVoted) {
        console.log("VOTE WILL FAIL: Platform wallet has already voted");
      } else if (!isActive) {
        console.log("VOTE WILL FAIL: Poll is not active");
      } else if (hasEnded) {
        console.log("VOTE WILL FAIL: Poll has ended");
      } else if (!isValidOption) {
        console.log("VOTE WILL FAIL: Invalid option index");
      } else {
        console.log("Vote should succeed - no obvious restrictions detected");
      }
      
      // Try to vote anyway
      console.log(`Submitting vote transaction...`);
      const tx = await pollContract.vote(optionIndex, this.gasSettings);
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed: ${receipt.transactionHash}`);
      console.log(`Transaction status: ${receipt.status} (1=success, 0=failure)`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: receipt.status === 1,
        platformAddress: this.platformWallet.address
      };
    } catch (error) {
      console.error('Error in direct vote process:', error);
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
      
      console.log("FAILURE REASON:", failureReason);
      if (error.reason) console.error("Error reason:", error.reason);
      if (error.code) console.error("Error code:", error.code);
      if (error.receipt) console.error("Transaction receipt status:", error.receipt.status);
      
      throw error;
    }
  }
}

module.exports = RelayerService;