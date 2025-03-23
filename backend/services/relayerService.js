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
      console.log(`Relaying Magic vote: Poll=${pollAddress}, Voter=${voterAddress}, Option=${optionIndex}`);
      
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.platformWallet
      );
      
      // Split signature into v, r, s
      const { v, r, s } = ethers.utils.splitSignature(signature);
      
      console.log(`Signature split: v=${v}, r=${r.slice(0, 10)}..., s=${s.slice(0, 10)}...`);
      
      // Submit the meta-transaction
      const tx = await pollContract.metaVote(
        voterAddress, 
        optionIndex, 
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
      console.error('Error relaying Magic vote:', error);
      throw error;
    }
  }
  
  // For non-Magic users with smart wallets
  async relaySmartWalletVote(smartWalletAddress, pollAddress, optionIndex, signature) {
    try {
      console.log(`Relaying Smart Wallet vote: Wallet=${smartWalletAddress}, Poll=${pollAddress}, Option=${optionIndex}`);
      
      // Get Smart Wallet contract
      const smartWallet = new ethers.Contract(
        smartWalletAddress,
        SmartWallet.abi,
        this.platformWallet
      );
      
      // Encode the vote function call
      const pollInterface = new ethers.utils.Interface(Poll.abi);
      const callData = pollInterface.encodeFunctionData('vote', [optionIndex]);
      
      console.log(`Call data encoded: ${callData.slice(0, 20)}...`);
      
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
      console.error('Error relaying smart wallet vote:', error);
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
  
  // Claim reward through smart wallet
  async relaySmartWalletRewardClaim(smartWalletAddress, pollAddress, signature) {
    try {
      console.log(`Relaying Smart Wallet reward claim: Wallet=${smartWalletAddress}, Poll=${pollAddress}`);
      
      // Get Smart Wallet contract
      const smartWallet = new ethers.Contract(
        smartWalletAddress,
        SmartWallet.abi,
        this.platformWallet
      );
      
      // Encode the claimReward function call
      const pollInterface = new ethers.utils.Interface(Poll.abi);
      const callData = pollInterface.encodeFunctionData('claimReward', []);
      
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
}

module.exports = RelayerService;