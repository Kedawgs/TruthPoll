// backend/services/contractService.js
const ethers = require('ethers');
const PollFactory = require('../artifacts/contracts/PollFactory.sol/PollFactory.json');
const Poll = require('../artifacts/contracts/Poll.sol/Poll.json');

class ContractService {
  constructor(provider) {
    this.provider = provider;
    this.platformWallet = new ethers.Wallet(
      process.env.PLATFORM_WALLET_PRIVATE_KEY,
      provider
    );
    
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
        this.platformWallet
      );
      console.log(`PollFactory initialized at ${this.factoryAddress}`);
    } else {
      console.log('PollFactory address not set in environment variables');
    }
  }

  // Create a new poll
  async createPoll(title, options, duration = 0, rewardPerVoter = 0) {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      console.log(`Creating poll: ${title}, Options: ${options.length}, Duration: ${duration}, Reward: ${rewardPerVoter}`);
      
      // Parse reward to USDT decimals (6)
      const rewardPerVoterWei = rewardPerVoter > 0 
        ? ethers.utils.parseUnits(rewardPerVoter.toString(), 6) 
        : 0;
      
      // Create the poll with proper gas settings
      const tx = await this.factoryContract.createPoll(
        title,
        options,
        duration,
        rewardPerVoterWei,
        this.gasSettings
      );
      
      console.log(`Poll creation transaction submitted: ${tx.hash}`);
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      
      // Extract the poll address from the event
      const event = receipt.events.find(e => e.event === 'PollCreated');
      const pollAddress = event.args.pollAddress;
      
      console.log(`Poll created at ${pollAddress}`);
      
      return {
        transactionHash: receipt.transactionHash,
        pollAddress
      };
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }
  
  // Fund poll with rewards
  async fundPollRewards(pollAddress, amount) {
    try {
      console.log(`Funding poll ${pollAddress} with ${amount} USDT`);
      
      // Parse amount to USDT decimals (6)
      const amountWei = ethers.utils.parseUnits(amount.toString(), 6);
      
      // Get poll contract instance
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.platformWallet
      );
      
      // Fund rewards
      const tx = await pollContract.fundRewards(amountWei, this.gasSettings);
      console.log(`Fund rewards transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Poll funded successfully: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      console.error('Error funding poll rewards:', error);
      throw error;
    }
  }
  
  // Get poll details
  async getPollDetails(pollAddress) {
    try {
      console.log(`Getting details for poll ${pollAddress}`);
      
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
        console.warn(`This poll doesn't support rewards`, err.message);
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
      
      console.log(`Poll details retrieved for ${pollAddress}`);
      
      return pollDetails;
    } catch (error) {
      console.error(`Error getting poll details for ${pollAddress}:`, error);
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
      console.error(`Error checking if user ${userAddress} voted on poll ${pollAddress}:`, error);
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
      console.error(`Error getting user vote for ${userAddress} on poll ${pollAddress}:`, error);
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
      console.log(`Retrieved ${pollAddresses.length} polls`);
      
      return pollAddresses;
    } catch (error) {
      console.error('Error getting all polls:', error);
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
      console.log(`Retrieved ${pollAddresses.length} polls created by ${creatorAddress}`);
      
      return pollAddresses;
    } catch (error) {
      console.error(`Error getting polls for creator ${creatorAddress}:`, error);
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
      console.error(`Error checking if user ${userAddress} can claim reward for poll ${pollAddress}:`, error);
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
      console.error(`Error getting nonce for user ${userAddress} on poll ${pollAddress}:`, error);
      throw error;
    }
  }
}

module.exports = ContractService;