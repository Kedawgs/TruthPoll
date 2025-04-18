// backend/services/pollService.js
const Poll = require('../models/Poll');
const ContractService = require('./contractService');
const SmartWalletService = require('./smartWalletService');
const RelayerService = require('./relayerService');
const { NotFoundError, ValidationError, BlockchainError, AuthorizationError } = require('../utils/errorTypes');
const logger = require('../utils/logger');
const { getS3BaseUrl } = require('../utils/s3Utils');

class PollService {
  constructor(provider, platformPrivateKey) {
    this.provider = provider;
    this.contractService = new ContractService(provider, platformPrivateKey);
    this.relayerService = new RelayerService(provider, platformPrivateKey);
    this.smartWalletService = new SmartWalletService(provider, platformPrivateKey);
  }

  // --- Create Poll with USDT funding support ---
  async createPoll(pollData) {
    try {
      logger.info(`Creating poll: ${pollData.title} by ${pollData.creator}`);
      
      // Validation checks
      if (!pollData.options || pollData.options.length < 2) {
        throw new ValidationError('Poll must have at least 2 options');
      }
      
      // Handle image URL if provided
      if (pollData.image && !pollData.imageUrl) {
        pollData.imageUrl = `${getS3BaseUrl()}${pollData.image}`;
      }
      
      // Check if contract service is available
      if (!this.contractService.factoryContract) {
        throw new BlockchainError('Contract service not properly initialized');
      }

      // Determine if this is a poll with rewards
      const hasRewards = (pollData.rewardPerVoter || 0) > 0;
      const voteLimit = parseInt(pollData.voteLimit) || 0;
      
      let result;
      
      // If poll has rewards, use createAndFundPoll
      if (hasRewards && voteLimit > 0) {
        // Use provided fundAmount if available, otherwise calculate it
        let totalFundAmount;
        if (pollData.fundAmount !== undefined) {
          totalFundAmount = parseFloat(pollData.fundAmount);
        } else {
          // Calculate total funding amount based on reward per voter and vote limit
          const rewardPerVoter = parseFloat(pollData.rewardPerVoter);
          totalFundAmount = rewardPerVoter * voteLimit;
        }
        
        // Get platform fee if provided, otherwise null will use contract's calculation
        const platformFee = pollData.platformFee !== undefined ? parseFloat(pollData.platformFee) : null;
        
        logger.info(`Creating poll with funding: ${totalFundAmount} USDT for rewards, platform fee: ${platformFee || 'default'}`);
        
        // Call the createAndFundPoll method in contractService with possible explicit fee
        result = await this.contractService.createAndFundPoll(
          pollData.title,
          pollData.options,
          pollData.duration || 0,
          parseFloat(pollData.rewardPerVoter),
          totalFundAmount,
          pollData.creator,
          platformFee // Pass explicit fee amount if provided
        );
      } else {
        // For non-rewarded polls, we still need to collect the platform fee
        // but don't need to fund the poll with rewards
        if (pollData.platformFee) {
          logger.info(`Creating poll with platform fee: ${pollData.platformFee} USDT`);
        }
        
        // Regular poll creation without funding
        result = await this.contractService.createPoll(
          pollData.title,
          pollData.options,
          pollData.duration || 0,
          pollData.rewardPerVoter || 0
        );
      }
      
      logger.info(`Poll created on blockchain: ${result.pollAddress}`);
      
      // Save poll to database
      const poll = await Poll.create({
        title: pollData.title,
        description: pollData.description,
        options: pollData.options,
        creator: pollData.creator,
        contractAddress: result.pollAddress,
        duration: pollData.duration || 0,
        category: pollData.category || 'General',
        tags: pollData.tags || [],
        hasRewards: hasRewards,
        rewardPerVoter: pollData.rewardPerVoter || 0,
        image: pollData.image || null,
        imageUrl: pollData.imageUrl || null,
        voteLimit: voteLimit || 0
      });
      
      logger.info(`Poll saved to database: ${poll._id}`);
      
      // After successfully creating a poll, create activity record
      try {
        const Activity = require('../models/Activity');
        const User = require('../models/User');

        // Find user info
        const user = await User.findOne({ address: pollData.creator.toLowerCase() });

        // Create activity record
        const activity = await Activity.create({
          userAddress: pollData.creator.toLowerCase(),
          username: user ? user.username : null,
          avatar: user ? user.avatar : null,
          type: 'Created',
          pollId: poll._id,
          pollTitle: poll.title,
          timestamp: new Date()
        });

        // Emit WebSocket event for real-time updates if available
        if (global.io) {
          global.io.emit('activity-update', {
            _id: activity._id,
            userAddress: activity.userAddress,
            username: activity.username,
            avatarUrl: activity.avatar ? `${getS3BaseUrl()}${activity.avatar}` : null,
            type: activity.type,
            pollId: activity.pollId,
            pollTitle: activity.pollTitle,
            timestamp: activity.timestamp
          });
        }
      } catch (activityError) {
        // Don't fail the main operation if activity tracking fails
        logger.error("Error creating activity record:", activityError);
      }
      
      return { poll, transactionHash: result.transactionHash };
    } catch (error) {
      logger.error(`Error creating poll: ${error.message}`, error);
      if (error instanceof ValidationError || error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError('Failed to create poll on blockchain', error);
    }
  }

  // Get polls with filtering options
  async getPolls(options = {}) {
    try {
      // Parse query parameters
      const {
        page = 1,
        limit = 10,
        category = null,
        creator = null,
        active = null,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search = null,
        hasRewards = null
      } = options;

      logger.debug(`getPolls options: ${JSON.stringify(options)}`);

      // Build query
      const query = {};

      // Check if demographic tags should be filtered
      const demographicTags = ['Age', 'Gender', 'Race', 'Income', 'Pet Owner', 'Relationship', 'Education', 'Politics'];

      if (category) {
        // Check if the category is actually a demographic tag
        if (demographicTags.includes(category)) {
          logger.debug(`Filtering by tag: ${category}`);
          query.tags = category; // Filter by tag
        } else {
          logger.debug(`Filtering by category: ${category}`);
          query.category = category; // Filter by category
        }
      }

      if (creator) query.creator = creator;
      if (active !== null) {
        query.isActive = active === 'true' || active === true;
      }
      if (hasRewards !== null) {
        query.hasRewards = hasRewards === 'true' || hasRewards === true;
      }

      // Add search functionality
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      logger.debug(`Poll query: ${JSON.stringify(query)}`);

      // Calculate pagination
      const skip = (page - 1) * limit;
      
      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const polls = await Poll.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await Poll.countDocuments(query);
      
      // Ensure imageUrl is populated
      polls.forEach(poll => {
        if (poll.image && !poll.imageUrl) {
          poll.imageUrl = `${getS3BaseUrl()}${poll.image}`;
        }
      });

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

  // Get a single poll with on-chain data
  async getPoll(id) {
    try {
      const poll = await Poll.findById(id);
      if (!poll) {
        throw new NotFoundError('Poll');
      }
      
      logger.info(`Retrieved poll: ${id}`);
      
      // Ensure image URL is populated
      let pollNeedsSave = false;
      if (poll.image && !poll.imageUrl) {
        poll.imageUrl = `${getS3BaseUrl()}${poll.image}`;
        pollNeedsSave = true;
      }
      
      // Save if needed
      if (pollNeedsSave) {
        try {
          await poll.save();
          logger.info(`Updated imageUrl for poll ${id}`);
        } catch (saveError) {
          logger.error(`Failed to save updated imageUrl for poll ${id}: ${saveError.message}`);
        }
      }
      
      // Get blockchain data if available
      if (poll.contractAddress) {
        try {
          const onChainData = await this.contractService.getPollDetails(poll.contractAddress);
          
          // Return combined data
          return {
            data: {
              ...poll.toObject(),
              onChain: onChainData
            }
          };
        } catch (error) {
          logger.error(`Error fetching on-chain data for poll ${id}: ${error.message}`);
          
          // Return poll data without on-chain details
          return {
            data: {
              ...poll.toObject(),
              blockchainError: 'Failed to fetch on-chain data'
            }
          };
        }
      }
      
      // Return poll data without on-chain details
      return { data: poll.toObject() };
    } catch (error) {
      logger.error(`Error getting poll ${id}: ${error.message}`);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to get poll: ${error.message}`);
    }
  }

  // Vote on a poll with rewards handling
  async votePoll(pollId, voteData, user) {
    try {
      const { optionIndex, voterAddress, signature } = voteData;
      const { isMagicUser } = user || {};
      
      logger.info(`Vote requested: Poll=${pollId}, Voter=${voterAddress}, Option=${optionIndex}`);
      
      // Basic validation
      if (optionIndex === undefined) {
        throw new ValidationError('Please provide option index');
      }
      if (!voterAddress) {
        throw new ValidationError('Please provide voter address');
      }
      if (!signature) {
        throw new ValidationError('Please provide signature');
      }
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
      
      // Check if voter is creator (not allowed)
      const isCreator = poll.creator.toLowerCase() === voterAddress.toLowerCase();
      if (isCreator) {
        throw new ValidationError('Poll creator cannot vote on their own poll');
      }
      
      // Handle voting based on authentication type
      if (isMagicUser) {
        // For Magic users, verify they're voting as themselves
        if (user.publicAddress.toLowerCase() !== voterAddress.toLowerCase()) {
          throw new AuthorizationError('Unauthorized voting address');
        }
        
        logger.info(`Processing Magic user vote: ${voterAddress}`);
        
        // Relay vote via Magic
        const result = await this.relayerService.relayMagicVote(
          poll.contractAddress,
          voterAddress,
          optionIndex,
          signature
        );
        
        // Create activity after successful vote
        this.createVoteActivity(pollId, poll, voterAddress);
        
        return result;
      } else {
        // For wallet users, use their smart wallet
        logger.info(`Processing wallet user vote via smart wallet: ${voterAddress}`);
        
        // Get/deploy smart wallet
        const smartWalletAddress = await this.smartWalletService.getWalletAddress(voterAddress);
        let isDeployed = await this.smartWalletService.isWalletDeployed(smartWalletAddress);
        
        if (!isDeployed) {
          logger.info(`Deploying smart wallet for voter: ${voterAddress}`);
          await this.smartWalletService.deployWalletIfNeeded(voterAddress);
          isDeployed = await this.smartWalletService.isWalletDeployed(smartWalletAddress);
          
          if (!isDeployed) {
            throw new BlockchainError('Failed to deploy smart wallet');
          }
        }
        
        // Add delay to ensure the smart wallet is deployed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Relay vote via smart wallet
        const result = await this.relayerService.relaySmartWalletVote(
          smartWalletAddress,
          poll.contractAddress,
          optionIndex,
          signature
        );
        
        // Create activity after successful vote
        this.createVoteActivity(pollId, poll, voterAddress);
        
        return result;
      }
    } catch (error) {
      logger.error(`Error voting on poll ${pollId}: ${error.message}`);
      
      // Handle specific error cases
      if (error.message.includes("Already voted")) {
        throw new ValidationError("You have already voted on this poll");
      } else if (error.message.includes("Poll creator cannot vote")) {
        throw new ValidationError("Poll creator cannot vote on their own poll");
      } else if (error.message.includes("Poll is not active")) {
        throw new ValidationError("This poll is no longer active");
      } else if (error.message.includes("Invalid option")) {
        throw new ValidationError("Invalid option selected");
      } else if (error.message.includes("Invalid signature")) {
        throw new ValidationError("Invalid signature. Please try again.");
      } else if (error.message.includes("insufficient reward funds")) {
        throw new ValidationError("This poll has insufficient reward funds. The poll creator needs to add more funds.");
      }
      
      // Pass through known error types
      if (error instanceof ValidationError || error instanceof NotFoundError || 
          error instanceof AuthorizationError || error instanceof BlockchainError) {
        throw error;
      }
      
      // Default error
      throw new BlockchainError('Failed to process vote', error);
    }
  }

  // Helper method to create vote activity
  async createVoteActivity(pollId, poll, voterAddress) {
    try {
      const Activity = require('../models/Activity');
      const User = require('../models/User');

      // Find user info
      const user = await User.findOne({ address: voterAddress.toLowerCase() });

      // Create activity record
      const activity = await Activity.create({
        userAddress: voterAddress.toLowerCase(),
        username: user ? user.username : null,
        avatar: user ? user.avatar : null,
        type: 'Voted on',
        pollId: poll._id,
        pollTitle: poll.title,
        timestamp: new Date()
      });

      // Emit WebSocket event for real-time updates
      if (global.io) {
        global.io.emit('activity-update', {
          _id: activity._id,
          userAddress: activity.userAddress,
          username: activity.username,
          avatarUrl: activity.avatar ? `${getS3BaseUrl()}${activity.avatar}` : null,
          type: activity.type,
          pollId: activity.pollId,
          pollTitle: activity.pollTitle,
          timestamp: activity.timestamp
        });
      }
    } catch (activityError) {
      // Don't fail the main operation if activity tracking fails
      logger.error("Error creating vote activity record:", activityError);
    }
  }

  // End a poll
  async endPoll(pollId, user) {
    try {
      const { publicAddress } = user;
      
      // Get poll from database
      const poll = await Poll.findById(pollId);
      if (!poll) {
        throw new NotFoundError('Poll');
      }
      if (!poll.contractAddress) {
        throw new ValidationError('Poll contract not deployed');
      }
      
      // Verify ownership
      if (poll.creator.toLowerCase() !== publicAddress.toLowerCase()) {
        throw new AuthorizationError('Only the poll creator can end a poll');
      }
      
      // End poll on blockchain
      const result = await this.contractService.endPoll(poll.contractAddress);
      
      // Update database
      poll.isActive = false;
      await poll.save();
      
      logger.info(`Poll ${pollId} ended by ${publicAddress}`);
      
      return result;
    } catch (error) {
      logger.error(`Error ending poll ${pollId}: ${error.message}`);
      
      // Pass through known error types
      if (error instanceof ValidationError || error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      
      // Default error
      throw new BlockchainError('Failed to end poll', error);
    }
  }

  // Reactivate a poll
  async reactivatePoll(pollId, duration = 0, user) {
    try {
      const { publicAddress } = user;
      
      // Get poll from database
      const poll = await Poll.findById(pollId);
      if (!poll) {
        throw new NotFoundError('Poll');
      }
      if (!poll.contractAddress) {
        throw new ValidationError('Poll contract not deployed');
      }
      
      // Verify ownership
      if (poll.creator.toLowerCase() !== publicAddress.toLowerCase()) {
        throw new AuthorizationError('Only the poll creator can reactivate a poll');
      }
      
      // Reactivate poll on blockchain
      const result = await this.contractService.reactivatePoll(
        poll.contractAddress,
        duration
      );
      
      // Update database
      poll.isActive = true;
      if (duration > 0) {
        poll.duration = duration;
        poll.endTime = new Date(Date.now() + (duration * 1000));
      } else {
        poll.endTime = null;
      }
      await poll.save();
      
      logger.info(`Poll ${pollId} reactivated by ${publicAddress}`);
      
      return result;
    } catch (error) {
      logger.error(`Error reactivating poll ${pollId}: ${error.message}`);
      
      // Pass through known error types
      if (error instanceof ValidationError || error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      
      // Default error
      throw new BlockchainError('Failed to reactivate poll', error);
    }
  }

  // Get rewards received by a user
  async getReceivedRewards(userAddress) {
    try {
      // Find polls with rewards
      const polls = await Poll.find({ hasRewards: true });
      logger.info(`Checking received rewards for user ${userAddress} across ${polls.length} polls`);
      
      // Check rewards for each poll
      const receivedRewards = await Promise.all(
        polls.map(async (poll) => {
          try {
            // Check if user voted and received rewards
            const hasVoted = await this.contractService.hasUserVoted(poll.contractAddress, userAddress);
            const hasReceivedReward = await this.contractService.hasUserReceivedReward(poll.contractAddress, userAddress);
            
            return {
              pollId: poll._id,
              pollAddress: poll.contractAddress,
              pollTitle: poll.title,
              hasVoted,
              hasReceivedReward,
              rewardAmount: poll.rewardPerVoter
            };
          } catch (error) {
            logger.error(`Error checking rewards for poll ${poll._id}: ${error.message}`);
            
            // Return error state
            return {
              pollId: poll._id,
              pollAddress: poll.contractAddress,
              pollTitle: poll.title,
              hasVoted: false,
              hasReceivedReward: false,
              rewardAmount: poll.rewardPerVoter,
              error: 'Failed to check reward status'
            };
          }
        })
      );
      
      // Filter to only return polls where user voted
      return receivedRewards.filter(reward => reward.hasVoted);
    } catch (error) {
      logger.error(`Error getting received rewards for ${userAddress}: ${error.message}`);
      throw new Error('Failed to get received rewards');
    }
  }

  // Get user's nonce for a poll
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

  // Search polls
  async searchPolls(query) {
    try {
      if (!query) {
        throw new ValidationError('Please provide a search query');
      }
      
      // Search polls in database
      const polls = await Poll.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }).limit(10);
      
      logger.info(`Search for "${query}" returned ${polls.length} results`);
      
      // Ensure image URLs are populated
      polls.forEach(poll => {
        if (poll.image && !poll.imageUrl) {
          poll.imageUrl = `${getS3BaseUrl()}${poll.image}`;
        }
      });
      
      // Enhance with on-chain data
      const enhancedPolls = await Promise.all(
        polls.map(async (poll) => {
          try {
            if (poll.contractAddress) {
              const onChainData = await this.contractService.getPollDetails(poll.contractAddress);
              return { ...poll.toObject(), onChain: onChainData };
            }
            return poll.toObject();
          } catch (error) {
            logger.error(`Error fetching on-chain data for poll ${poll._id}:`, error);
            return poll.toObject();
          }
        })
      );
      
      return enhancedPolls;
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