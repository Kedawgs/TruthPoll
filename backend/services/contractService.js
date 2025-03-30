// backend/services/contractService.js
const ethers = require('ethers');
const PollFactory = require('../artifacts/contracts/PollFactory.sol/PollFactory.json');
const Poll = require('../artifacts/contracts/Poll.sol/Poll.json');
const logger = require('../utils/logger');

class ContractService {
  constructor(provider, platformWalletProvider) {
    this.provider = provider;
    this.platformWalletProvider = platformWalletProvider;
    
    // Default gas settings for Polygon
    this.gasSettings = {
      maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei"),
      maxFeePerGas: ethers.utils.parseUnits("35", "gwei"),
      gasLimit: 3000000
    };
    
    // Initialize factories
    this.factoryAddress = process.env.FACTORY_ADDRESS;
    this.usdtAddress = process.env.USDT_ADDRESS;
    
    if (this.factoryAddress) {
      this.factoryContract = new ethers.Contract(
        this.factoryAddress,
        PollFactory.abi,
        this.provider
      );
      logger.info(`PollFactory initialized at ${this.factoryAddress}`);
    } else {
      logger.warn('PollFactory address not set in environment variables');
    }
  }

  // Create a new poll
  async createPoll(title, options, duration = 0, rewardPerVoter = 0) {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      logger.info(`Creating poll: ${title}, Options: ${options.length}, Duration: ${duration}, Reward: ${rewardPerVoter}`);
      
      // Parse reward to USDT decimals (6)
      const rewardPerVoterWei = rewardPerVoter > 0 
        ? ethers.utils.parseUnits(rewardPerVoter.toString(), 6) 
        : 0;
      
      // Get signed contract
      const signedFactory = await this.platformWalletProvider.getSignedContract(
        this.factoryAddress,
        PollFactory.abi,
        'create_poll'
      );
      
      // Create the poll with proper gas settings
      const tx = await signedFactory.createPoll(
        title,
        options,
        duration,
        rewardPerVoterWei,
        this.gasSettings
      );
      
      logger.info(`Poll creation transaction submitted: ${tx.hash}`);
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      
      // Extract the poll address from the event
      const event = receipt.events.find(e => e.event === 'PollCreated');
      const pollAddress = event.args.pollAddress;
      
      logger.info(`Poll created at ${pollAddress}`);
      
      return {
        transactionHash: receipt.transactionHash,
        pollAddress
      };
    } catch (error) {
      logger.error('Error creating poll:', error);
      throw error;
    }
  }
  
  // Fund poll with rewards
  async fundPollRewards(pollAddress, amount) {
    try {
      logger.info(`Funding poll ${pollAddress} with ${amount} USDT`);
      
      // Parse amount to USDT decimals (6)
      const amountWei = ethers.utils.parseUnits(amount.toString(), 6);
      
      // Get signed contract
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'fund_rewards'
      );
      
      // Fund rewards
      const tx = await signedPoll.fundRewards(amountWei, this.gasSettings);
      logger.info(`Fund rewards transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Poll funded successfully: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error funding poll rewards:', error);
      throw error;
    }
  }
  
  // Get poll details
  async getPollDetails(pollAddress) {
    try {
      logger.info(`Getting details for poll ${pollAddress}`);
      
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      // Get basic poll info
      const title = await pollContract.title();
      const options = await pollContract.getOptions();
      const isActive = await pollContract.isPollActive();
      const results = await pollContract.getResults();
      const totalVotes = await pollContract.totalVotes();
      const creationTime = await pollContract.creationTime();
      const endTime = await pollContract.endTime();
      const owner = await pollContract.owner();
      
      // Get reward info if USDT is available
      let rewardPerVoter = ethers.BigNumber.from(0);
      let totalRewards = ethers.BigNumber.from(0);
      
      try {
        rewardPerVoter = await pollContract.rewardPerVoter();
        totalRewards = await pollContract.totalRewards();
      } catch (err) {
        logger.warn(`This poll doesn't support rewards`, err.message);
      }
      
      // Format results
      const pollDetails = {
        title,
        options,
        isActive,
        results: results.map(r => r.toNumber()),
        totalVotes: totalVotes.toNumber(),
        creationTime: new Date(creationTime.toNumber() * 1000),
        endTime: endTime.toNumber() > 0 ? new Date(endTime.toNumber() * 1000) : null,
        owner,
        hasRewards: !rewardPerVoter.isZero(),
        rewardPerVoter: ethers.utils.formatUnits(rewardPerVoter, 6),
        totalRewards: ethers.utils.formatUnits(totalRewards, 6)
      };
      
      logger.info(`Poll details retrieved for ${pollAddress}`);
      
      return pollDetails;
    } catch (error) {
      logger.error(`Error getting poll details for ${pollAddress}:`, error);
      throw error;
    }
  }
  
  // Check if user has voted
  async hasUserVoted(pollAddress, userAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      return await pollContract.hasVoted(userAddress);
    } catch (error) {
      logger.error(`Error checking if user ${userAddress} voted on poll ${pollAddress}:`, error);
      throw error;
    }
  }
  
  // Get user vote
  async getUserVote(pollAddress, userAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      // Check if user has voted first
      const hasVoted = await pollContract.hasVoted(userAddress);
      
      if (!hasVoted) {
        return -1; // User hasn't voted
      }
      
      return await pollContract.getUserVote(userAddress);
    } catch (error) {
      logger.error(`Error getting user vote for ${userAddress} on poll ${pollAddress}:`, error);
      // Return -1 if there's an error (user hasn't voted)
      return -1;
    }
  }
  
  // Get all polls
  async getAllPolls() {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      const pollAddresses = await this.factoryContract.getDeployedPolls();
      logger.info(`Retrieved ${pollAddresses.length} polls`);
      
      return pollAddresses;
    } catch (error) {
      logger.error('Error getting all polls:', error);
      throw error;
    }
  }
  
  // Get polls by creator
  async getPollsByCreator(creatorAddress) {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      const pollAddresses = await this.factoryContract.getPollsByCreator(creatorAddress);
      logger.info(`Retrieved ${pollAddresses.length} polls created by ${creatorAddress}`);
      
      return pollAddresses;
    } catch (error) {
      logger.error(`Error getting polls for creator ${creatorAddress}:`, error);
      throw error;
    }
  }
  
  // Check if user can claim reward
  async canClaimReward(pollAddress, userAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      return await pollContract.canClaimReward(userAddress);
    } catch (error) {
      logger.error(`Error checking if user ${userAddress} can claim reward for poll ${pollAddress}:`, error);
      return false;
    }
  }
  
  // Get current nonce for a user
  async getUserNonce(pollAddress, userAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      const nonce = await pollContract.getNonce(userAddress);
      return nonce.toNumber();
    } catch (error) {
      logger.error(`Error getting nonce for user ${userAddress} on poll ${pollAddress}:`, error);
      throw error;
    }
  }

  // End poll (needs signing)
  async endPoll(pollAddress) {
    try {
      logger.info(`Ending poll at ${pollAddress}`);
      
      // Get signed contract
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'end_poll'
      );
      
      // Call the endPoll function
      const tx = await signedPoll.endPoll(this.gasSettings);
      logger.info(`End poll transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Poll ended successfully: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error(`Error ending poll ${pollAddress}:`, error);
      throw error;
    }
  }

  // Reactivate poll (needs signing)
  async reactivatePoll(pollAddress, duration = 0) {
    try {
      logger.info(`Reactivating poll at ${pollAddress} with duration ${duration}`);
      
      // Get signed contract
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'reactivate_poll'
      );
      
      // Call the reactivatePoll function
      const tx = await signedPoll.reactivatePoll(duration, this.gasSettings);
      logger.info(`Reactivate poll transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Poll reactivated successfully: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error(`Error reactivating poll ${pollAddress}:`, error);
      throw error;
    }
  }

  // Withdraw remaining rewards (needs signing)
  async withdrawRemainingRewards(pollAddress) {
    try {
      logger.info(`Withdrawing remaining rewards from poll ${pollAddress}`);
      
      // Get signed contract
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'withdraw_rewards'
      );
      
      // Call the withdrawRemainingRewards function
      const tx = await signedPoll.withdrawRemainingRewards(this.gasSettings);
      logger.info(`Withdraw rewards transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Rewards withdrawn successfully: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error(`Error withdrawing rewards from poll ${pollAddress}:`, error);
      throw error;
    }
  }
  
  // Deploy factory contract - admin function
  async deployFactory() {
    try {
      logger.info('Deploying new PollFactory contract');
      
      // Get signer
      const signer = await this.platformWalletProvider.getSigner('deploy_factory');
      
      // Get the factory contract factory
      const Factory = new ethers.ContractFactory(
        PollFactory.abi,
        PollFactory.bytecode,
        signer
      );
      
      // Deploy the contract
      const factory = await Factory.deploy(
        this.usdtAddress,
        this.gasSettings
      );
      
      logger.info(`Factory deployment transaction submitted: ${factory.deployTransaction.hash}`);
      
      // Wait for deployment
      await factory.deployed();
      
      logger.info(`Factory deployed at: ${factory.address}`);
      
      return factory.address;
    } catch (error) {
      logger.error('Error deploying factory:', error);
      throw error;
    }
  }
}

module.exports = ContractService;