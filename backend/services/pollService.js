// backend/services/pollService.js
const Poll = require('../models/Poll');
const ContractService = require('./contractService');
const SmartWalletService = require('./smartWalletService');
const RelayerService = require('./relayerService');
const { NotFoundError, ValidationError, BlockchainError, AuthorizationError } = require('../utils/errorTypes');
const logger = require('../utils/logger');

class PollService {
  constructor(provider, platformPrivateKey) {
    this.provider = provider;
    this.contractService = new ContractService(provider, platformPrivateKey);
    this.relayerService = new RelayerService(provider, platformPrivateKey);
    this.smartWalletService = new SmartWalletService(provider, platformPrivateKey);
  }
  
  /**
   * Create a new poll
   * @param {Object} pollData - Poll data
   * @param {String} pollData.title - Poll title
   * @param {String} pollData.description - Poll description
   * @param {Array} pollData.options - Poll options
   * @param {String} pollData.creator - Creator address
   * @param {Number} pollData.duration - Duration in seconds
   * @param {String} pollData.category - Poll category
   * @param {Array} pollData.tags - Poll tags
   * @param {Number} pollData.rewardPerVoter - USDT reward per voter
   * @returns {Object} Created poll and transaction info
   */
  async createPoll(pollData) {
    try {
      logger.info(`Creating poll: ${pollData.title} by ${pollData.creator}`);
      
      // Validate options
      if (!pollData.options || pollData.options.length < 2) {
        throw new ValidationError('Poll must have at least 2 options');
      }
      
      // Check if contract service is initialized
      if (!this.contractService.factoryContract) {
        throw new BlockchainError('Contract service not properly initialized');
      }
      
      // Create the poll on the blockchain
      const result = await this.contractService.createPoll(
        pollData.title,
        pollData.options,
        pollData.duration || 0,
        pollData.rewardPerVoter || 0
      );
      
      logger.info(`Poll created on blockchain: ${result.pollAddress}`);
      
      // Create the poll in the database
      const poll = await Poll.create({
        title: pollData.title,
        description: pollData.description,
        options: pollData.options,
        creator: pollData.creator,
        contractAddress: result.pollAddress,
        duration: pollData.duration || 0,
        category: pollData.category || 'General',
        tags: pollData.tags || [],
        hasRewards: (pollData.rewardPerVoter || 0) > 0,
        rewardPerVoter: pollData.rewardPerVoter || 0
      });
      
      logger.info(`Poll saved to database: ${poll._id}`);
      
      return {
        poll,
        transactionHash: result.transactionHash
      };
    } catch (error) {
      logger.error(`Error creating poll: ${error.message}`);
      
      if (error instanceof ValidationError || error instanceof BlockchainError) {
        throw error;
      }
      
      throw new BlockchainError('Failed to create poll on blockchain', error);
    }
  }
  
  /**
   * Get polls with pagination and filters
   * @param {Object} options - Filter and pagination options
   * @param {Number} options.page - Page number
   * @param {Number} options.limit - Items per page
   * @param {String} options.category - Filter by category
   * @param {String} options.creator - Filter by creator address
   * @param {Boolean} options.isActive - Filter by active status
   * @param {String} options.sortBy - Sort field
   * @param {String} options.sortOrder - Sort direction (asc/desc)
   * @param {String} options.search - Search term
   * @returns {Object} Paginated polls with metadata
   */
  async getPolls(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        category = null,
        creator = null,
        active = null,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search = null
      } = options;
      
      // Debug all polls first
      const allPolls = await Poll.find({});
      logger.info(`Total polls in database with no filter: ${allPolls.length}`);
      
      // Build query
      const query = {};
      
      if (category) query.category = category;
      if (creator) query.creator = creator;
    if (active !== null) {
      query.isActive = active === 'true';
    }
      
      // Add search functionality
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }
      
      // Debug query
      logger.debug(`Query parameters: ${JSON.stringify(query)}`);
      
      // Calculate pagination
      const skip = (page - 1) * limit;
      
      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Debug sort and pagination
      logger.debug(`Sort parameters: ${JSON.stringify(sort)}`);
      logger.debug(`Skip: ${skip}, Limit: ${limit}`);
      
      // Execute query
      const polls = await Poll.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      // Debug results
      logger.debug(`Raw poll results: ${polls.length} items`);
      
      // Get total count
      const total = await Poll.countDocuments(query);
      
      logger.info(`Retrieved ${polls.length} polls (page ${page} of ${Math.ceil(total / limit) || 1})`);
      
      return {
        data: polls,
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1
      };
    } catch (error) {
      logger.error(`Error getting polls: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get a poll by ID with blockchain data
   * @param {String} id - Poll ID
   * @returns {Object} Poll data with blockchain info
   */
  async getPoll(id) {
    try {
      const poll = await Poll.findById(id);
      
      if (!poll) {
        throw new NotFoundError('Poll');
      }
      
      logger.info(`Retrieved poll: ${id}`);
      
      // Get on-chain data if available
      if (poll.contractAddress) {
        try {
          const onChainData = await this.contractService.getPollDetails(poll.contractAddress);
          
          // Combine database and blockchain data
          return {
            ...poll.toObject(),
            onChain: onChainData
          };
        } catch (error) {
          logger.error(`Error fetching on-chain data for poll ${id}: ${error.message}`);
          
          // Return just the database data if blockchain fetch fails
          return {
            ...poll.toObject(),
            blockchainError: 'Failed to fetch on-chain data'
          };
        }
      }
      
      return poll;
    } catch (error) {
      logger.error(`Error getting poll ${id}: ${error.message}`);
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new Error(`Failed to get poll: ${error.message}`);
    }
  }
  
  /**
   * Vote on a poll
   * @param {String} pollId - Poll ID
   * @param {Object} voteData - Vote data
   * @param {Number} voteData.optionIndex - Option index
   * @param {String} voteData.voterAddress - Voter address
   * @param {String} voteData.signature - Vote signature
   * @param {Object} user - User info from auth middleware
   * @returns {Object} Vote transaction result
   */
  async votePoll(pollId, voteData, user) {
    try {
      const { optionIndex, voterAddress, signature } = voteData;
      const { isMagicUser } = user || {};
      
      logger.info(`Vote requested: Poll=${pollId}, Voter=${voterAddress}, Option=${optionIndex}`);
      
      // Validate input
      if (optionIndex === undefined) {
        throw new ValidationError('Please provide option index');
      }
      
      if (!voterAddress) {
        throw new ValidationError('Please provide voter address');
      }
      
      if (!signature) {
        throw new ValidationError('Please provide signature');
      }
      
      // Validate signature format
      if (!signature.startsWith('0x') || signature.length !== 132) {
        throw new ValidationError('Invalid signature format');
      }
      
      // Get poll from database
      const poll = await Poll.findById(pollId);
      
      if (!poll) {
        throw new NotFoundError('Poll');
      }
      
      if (!poll.contractAddress) {
        throw new ValidationError('Poll contract not deployed');
      }
      
      // Check if user is the poll creator
      const isCreator = poll.creator.toLowerCase() === voterAddress.toLowerCase();
      
      if (isCreator) {
        throw new ValidationError('Poll creator cannot vote on their own poll');
      }
      
      // For Magic users, verify user is authenticated
      if (isMagicUser) {
        if (user.publicAddress.toLowerCase() !== voterAddress.toLowerCase()) {
          throw new AuthorizationError('Unauthorized voting address');
        }
        
        logger.info(`Processing Magic user vote: ${voterAddress}`);
        
        // Relay the transaction
        const result = await this.relayerService.relayMagicVote(
          poll.contractAddress,
          voterAddress,
          optionIndex,
          signature
        );
        
        return result;
      } else {
        logger.info(`Processing non-Magic user vote via smart wallet: ${voterAddress}`);
        
        // Get or deploy the smart wallet
        const smartWalletAddress = await this.smartWalletService.getWalletAddress(voterAddress);
        
        // Check if it's deployed
        let isDeployed = await this.smartWalletService.isWalletDeployed(smartWalletAddress);
        
        // Deploy if needed
        if (!isDeployed) {
          logger.info(`Deploying smart wallet for voter: ${voterAddress}`);
          await this.smartWalletService.deployWalletIfNeeded(voterAddress);
          
          // Verify deployment succeeded
          isDeployed = await this.smartWalletService.isWalletDeployed(smartWalletAddress);
          
          if (!isDeployed) {
            throw new BlockchainError('Failed to deploy smart wallet');
          }
        }
        
        // Small delay to ensure everything is synchronized
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Relay through smart wallet
        const result = await this.relayerService.relaySmartWalletVote(
          smartWalletAddress,
          poll.contractAddress,
          optionIndex,
          signature
        );
        
        return result;
      }
    } catch (error) {
      logger.error(`Error voting on poll ${pollId}: ${error.message}`);
      
      // Improve error messages
      if (error.message.includes("Poll creator cannot vote")) {
        throw new ValidationError("Poll creator cannot vote on their own poll");
      } else if (error.message.includes("Already voted")) {
        throw new ValidationError("You have already voted on this poll");
      } else if (error.message.includes("Poll is not active")) {
        throw new ValidationError("This poll is not active");
      } else if (error.message.includes("Poll has ended")) {
        throw new ValidationError("This poll has ended");
      } else if (error.message.includes("Invalid option")) {
        throw new ValidationError("Invalid option selected");
      } else if (error.message.includes("Invalid signature")) {
        throw new ValidationError("Invalid signature. Please try again.");
      }
      
      if (error instanceof ValidationError || 
          error instanceof NotFoundError || 
          error instanceof AuthorizationError ||
          error instanceof BlockchainError) {
        throw error;
      }
      
      throw new BlockchainError('Failed to process vote', error);
    }
  }
  
  /**
   * End a poll
   * @param {String} pollId - Poll ID
   * @param {Object} user - User info from auth middleware
   * @returns {Object} Transaction result
   */
  async endPoll(pollId, user) {
    try {
      const { isMagicUser } = user || {};
      const userAddress = isMagicUser ? user.publicAddress : null;
      
      // Get poll from database
      const poll = await Poll.findById(pollId);
      
      if (!poll) {
        throw new NotFoundError('Poll');
      }
      
      if (!poll.contractAddress) {
        throw new ValidationError('Poll contract not deployed');
      }
      
      // Verify poll creator for Magic users
      if (isMagicUser && poll.creator.toLowerCase() !== userAddress.toLowerCase()) {
        throw new AuthorizationError('Only the poll creator can end a poll');
      }
      
      // End the poll via the contract service
      const result = await this.contractService.endPoll(poll.contractAddress);
      
      // Update the poll in the database
      poll.isActive = false;
      await poll.save();
      
      logger.info(`Poll ${pollId} ended by ${userAddress || 'unknown user'}`);
      
      return result;
    } catch (error) {
      logger.error(`Error ending poll ${pollId}: ${error.message}`);
      
      if (error instanceof ValidationError || 
          error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      
      throw new BlockchainError('Failed to end poll', error);
    }
  }
  
  /**
   * Reactivate a poll
   * @param {String} pollId - Poll ID
   * @param {Number} duration - New duration in seconds
   * @param {Object} user - User info from auth middleware
   * @returns {Object} Transaction result
   */
  async reactivatePoll(pollId, duration = 0, user) {
    try {
      const { isMagicUser } = user || {};
      const userAddress = isMagicUser ? user.publicAddress : null;
      
      // Get poll from database
      const poll = await Poll.findById(pollId);
      
      if (!poll) {
        throw new NotFoundError('Poll');
      }
      
      if (!poll.contractAddress) {
        throw new ValidationError('Poll contract not deployed');
      }
      
      // Verify poll creator for Magic users
      if (isMagicUser && poll.creator.toLowerCase() !== userAddress.toLowerCase()) {
        throw new AuthorizationError('Only the poll creator can reactivate a poll');
      }
      
      // Reactivate the poll via the contract service
      const result = await this.contractService.reactivatePoll(
        poll.contractAddress, 
        duration
      );
      
      // Update the poll in the database
      poll.isActive = true;
      if (duration > 0) {
        poll.duration = duration;
        poll.endTime = new Date(Date.now() + (duration * 1000));
      }
      await poll.save();
      
      logger.info(`Poll ${pollId} reactivated by ${userAddress || 'unknown user'}`);
      
      return result;
    } catch (error) {
      logger.error(`Error reactivating poll ${pollId}: ${error.message}`);
      
      if (error instanceof ValidationError || 
          error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      
      throw new BlockchainError('Failed to reactivate poll', error);
    }
  }
  
  /**
   * Claim reward for a poll
   * @param {String} pollAddress - Poll contract address
   * @param {String} signature - Claim signature
   * @param {Object} user - User info from auth middleware
   * @returns {Object} Transaction result
   */
  async claimReward(pollAddress, signature, user) {
    try {
      if (!pollAddress || !signature) {
        throw new ValidationError('Please provide poll address and signature');
      }
      
      const { isMagicUser } = user || {};
      const userAddress = user.publicAddress;
      
      logger.info(`Reward claim requested: Poll=${pollAddress}, User=${userAddress}`);
      
      // For Magic users, relay directly
      if (isMagicUser) {
        logger.info(`Processing Magic user reward claim: ${userAddress}`);
        
        const result = await this.relayerService.relayMagicRewardClaim(
          pollAddress,
          userAddress,
          signature
        );
        
        return result;
      } else {
        logger.info(`Processing non-Magic user reward claim via smart wallet: ${userAddress}`);
        
        // For non-Magic users - use smart wallet
        const smartWalletAddress = await this.smartWalletService.getWalletAddress(userAddress);
        
        // Verify smart wallet is deployed
        const isDeployed = await this.smartWalletService.isWalletDeployed(smartWalletAddress);
        
        if (!isDeployed) {
          await this.smartWalletService.deployWalletIfNeeded(userAddress);
          
          // Wait for deployment confirmation
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Relay through smart wallet
        const result = await this.relayerService.relaySmartWalletRewardClaim(
          smartWalletAddress,
          pollAddress,
          signature
        );
        
        return result;
      }
    } catch (error) {
      logger.error(`Error claiming reward for poll ${pollAddress}: ${error.message}`);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new BlockchainError('Failed to claim reward', error);
    }
  }
  
  /**
   * Get claimable rewards for a user
   * @param {String} userAddress - User address
   * @returns {Array} Claimable rewards
   */
  async getClaimableRewards(userAddress) {
    try {
      // Find all polls with rewards
      const polls = await Poll.find({ hasRewards: true });
      
      logger.info(`Checking claimable rewards for user ${userAddress} across ${polls.length} polls`);
      
      // Check which rewards are claimable
      const claimableRewards = await Promise.all(
        polls.map(async (poll) => {
          const canClaim = await this.contractService.canClaimReward(poll.contractAddress, userAddress);
          const hasVoted = await this.contractService.hasUserVoted(poll.contractAddress, userAddress);
          
          return {
            pollId: poll._id,
            pollAddress: poll.contractAddress,
            pollTitle: poll.title,
            canClaim,
            hasVoted,
            rewardAmount: poll.rewardPerVoter
          };
        })
      );
      
      // Filter to only include polls where user has voted
      return claimableRewards.filter(reward => reward.hasVoted);
    } catch (error) {
      logger.error(`Error getting claimable rewards for ${userAddress}: ${error.message}`);
      throw new Error('Failed to get claimable rewards');
    }
  }
  
  /**
   * Get user's nonce for a poll (for signing)
   * @param {String} pollAddress - Poll contract address
   * @param {String} userAddress - User address
   * @returns {Number} User nonce
   */
  async getUserNonce(pollAddress, userAddress) {
    try {
      const nonce = await this.contractService.getUserNonce(pollAddress, userAddress);
      
      logger.info(`Retrieved nonce for user ${userAddress} on poll ${pollAddress}: ${nonce}`);
      
      return { nonce };
    } catch (error) {
      logger.error(`Error getting user nonce: ${error.message}`);
      throw new BlockchainError('Failed to get user nonce', error);
    }
  }
  
  /**
   * Search for polls
   * @param {String} query - Search query
   * @returns {Array} Matching polls
   */
  async searchPolls(query) {
    try {
      if (!query) {
        throw new ValidationError('Please provide a search query');
      }
      
      // Search in title, description, and tags
      const polls = await Poll.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      });
      
      logger.info(`Search for "${query}" returned ${polls.length} results`);
      
      return polls;
    } catch (error) {
      logger.error(`Error searching polls: ${error.message}`);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new Error('Failed to search polls');
    }
  }
}

module.exports = PollService;