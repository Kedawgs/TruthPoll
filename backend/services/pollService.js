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

  // --- createPoll method (unchanged from your provided code) ---
  async createPoll(pollData) {
    try {
      logger.info(`Creating poll: ${pollData.title} by ${pollData.creator}`);
      if (!pollData.options || pollData.options.length < 2) { throw new ValidationError('Poll must have at least 2 options'); }
      if (pollData.image && !pollData.imageUrl) { pollData.imageUrl = `${getS3BaseUrl()}${pollData.image}`; }
      if (!this.contractService.factoryContract) { throw new BlockchainError('Contract service not properly initialized'); }
      const result = await this.contractService.createPoll( pollData.title, pollData.options, pollData.duration || 0, pollData.rewardPerVoter || 0 );
      logger.info(`Poll created on blockchain: ${result.pollAddress}`);
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
        rewardPerVoter: pollData.rewardPerVoter || 0,
        image: pollData.image || null,
        imageUrl: pollData.imageUrl || null
      });
      logger.info(`Poll saved to database: ${poll._id}`);
      return { poll, transactionHash: result.transactionHash };
    } catch (error) {
      logger.error(`Error creating poll: ${error.message}`);
      if (error instanceof ValidationError || error instanceof BlockchainError) { throw error; }
      throw new BlockchainError('Failed to create poll on blockchain', error);
    }
  }

  // --- getPolls method (WITH THE REQUIRED CHANGE) ---
  async getPolls(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        category = null, // Still receiving the parameter as 'category'
        creator = null,
        active = null,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search = null,
        hasRewards = null
      } = options;

      logger.debug(`getPolls options received: ${JSON.stringify(options)}`);

      // Build query
      const query = {};

      // --- MODIFICATION TO HANDLE TAGS via category param ---
      // List of tags that should be treated as tag filters when passed via 'category' param
      const demographicTags = ['Age', 'Gender', 'Race', 'Income', 'Pet Owner', 'Relationship', 'Education', 'Politics']; // Keep this consistent

      if (category) {
        // Check if the received 'category' value is intended as a tag filter
        if (demographicTags.includes(category)) {
          logger.debug(`Filtering by tag: ${category}`);
          // Query the 'tags' array field in MongoDB
          query.tags = category; // Find polls where the 'tags' array contains the 'category' value
        } else {
          // Otherwise, treat it as a standard category filter
          logger.debug(`Filtering by category field: ${category}`);
          query.category = category; // Filter the 'category' field
        }
      }
      // --- END MODIFICATION ---

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
          { tags: { $in: [new RegExp(search, 'i')] } } // Also search tags?
        ];
      }

      logger.debug(`Executing poll query: ${JSON.stringify(query)}`);

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
      logger.info(`Retrieved ${polls.length} polls matching criteria.`);

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
      throw error; // Re-throw the error
    }
  }

  // --- getPoll method (unchanged from your provided code) ---
  async getPoll(id) {
     try {
       const poll = await Poll.findById(id);
       if (!poll) { throw new NotFoundError('Poll'); }
       logger.info(`Retrieved poll: ${id}`);
       let pollNeedsSave = false;
       if (poll.image && !poll.imageUrl) { poll.imageUrl = `${getS3BaseUrl()}${poll.image}`; pollNeedsSave = true; }
       if (pollNeedsSave) { try { await poll.save(); logger.info(`Updated imageUrl for poll ${id}`); } catch (saveError) { logger.error(`Failed to save updated imageUrl for poll ${id}: ${saveError.message}`); } }
       if (poll.contractAddress) {
         try {
           const onChainData = await this.contractService.getPollDetails(poll.contractAddress);
           return { ...poll.toObject(), onChain: onChainData };
         } catch (error) {
           logger.error(`Error fetching on-chain data for poll ${id}: ${error.message}`);
           return { ...poll.toObject(), blockchainError: 'Failed to fetch on-chain data' };
         }
       }
       return poll.toObject();
     } catch (error) {
       logger.error(`Error getting poll ${id}: ${error.message}`);
       if (error instanceof NotFoundError) { throw error; }
       throw new Error(`Failed to get poll: ${error.message}`);
     }
   }

  // --- votePoll method (unchanged from your provided code) ---
  async votePoll(pollId, voteData, user) {
    try {
      const { optionIndex, voterAddress, signature } = voteData;
      const { isMagicUser } = user || {};
      logger.info(`Vote requested: Poll=${pollId}, Voter=${voterAddress}, Option=${optionIndex}`);
      if (optionIndex === undefined) { throw new ValidationError('Please provide option index'); }
      if (!voterAddress) { throw new ValidationError('Please provide voter address'); }
      if (!signature) { throw new ValidationError('Please provide signature'); }
      if (!signature.startsWith('0x') || signature.length !== 132) { throw new ValidationError('Invalid signature format'); }
      const poll = await Poll.findById(pollId);
      if (!poll) { throw new NotFoundError('Poll'); }
      if (!poll.contractAddress) { throw new ValidationError('Poll contract not deployed'); }
      const isCreator = poll.creator.toLowerCase() === voterAddress.toLowerCase();
      if (isCreator) { throw new ValidationError('Poll creator cannot vote on their own poll'); }
      if (isMagicUser) {
        if (user.publicAddress.toLowerCase() !== voterAddress.toLowerCase()) { throw new AuthorizationError('Unauthorized voting address'); }
        logger.info(`Processing Magic user vote: ${voterAddress}`);
        const result = await this.relayerService.relayMagicVote( poll.contractAddress, voterAddress, optionIndex, signature ); return result;
      } else {
        logger.info(`Processing non-Magic user vote via smart wallet: ${voterAddress}`);
        const smartWalletAddress = await this.smartWalletService.getWalletAddress(voterAddress);
        let isDeployed = await this.smartWalletService.isWalletDeployed(smartWalletAddress);
        if (!isDeployed) {
          logger.info(`Deploying smart wallet for voter: ${voterAddress}`);
          await this.smartWalletService.deployWalletIfNeeded(voterAddress);
          isDeployed = await this.smartWalletService.isWalletDeployed(smartWalletAddress);
          if (!isDeployed) { throw new BlockchainError('Failed to deploy smart wallet'); }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        const result = await this.relayerService.relaySmartWalletVote( smartWalletAddress, poll.contractAddress, optionIndex, signature ); return result;
      }
    } catch (error) {
      logger.error(`Error voting on poll ${pollId}: ${error.message}`);
      if (error.message.includes("Poll creator cannot vote")) { throw new ValidationError("Poll creator cannot vote on their own poll"); }
      else if (error.message.includes("Already voted")) { throw new ValidationError("You have already voted on this poll"); }
      else if (error.message.includes("Poll is not active")) { throw new ValidationError("This poll is not active"); }
      else if (error.message.includes("Poll has ended")) { throw new ValidationError("This poll has ended"); }
      else if (error.message.includes("Invalid option")) { throw new ValidationError("Invalid option selected"); }
      else if (error.message.includes("Invalid signature")) { throw new ValidationError("Invalid signature. Please try again."); }
      else if (error.message.includes("Insufficient reward funds")) { throw new ValidationError("This poll has insufficient reward funds. The poll creator needs to add more funds."); }
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof AuthorizationError || error instanceof BlockchainError) { throw error; }
      throw new BlockchainError('Failed to process vote', error);
    }
  }

  // --- endPoll method (unchanged from your provided code) ---
  async endPoll(pollId, user) {
     try {
       const { publicAddress } = user;
       const poll = await Poll.findById(pollId);
       if (!poll) { throw new NotFoundError('Poll'); }
       if (!poll.contractAddress) { throw new ValidationError('Poll contract not deployed'); }
       if (poll.creator.toLowerCase() !== publicAddress.toLowerCase()) { throw new AuthorizationError('Only the poll creator can end a poll'); }
       const result = await this.contractService.endPoll(poll.contractAddress);
       poll.isActive = false; await poll.save();
       logger.info(`Poll ${pollId} ended by ${publicAddress}`);
       return result;
     } catch (error) {
       logger.error(`Error ending poll ${pollId}: ${error.message}`);
       if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof AuthorizationError) { throw error; }
       throw new BlockchainError('Failed to end poll', error);
     }
   }

  // --- reactivatePoll method (unchanged from your provided code) ---
   async reactivatePoll(pollId, duration = 0, user) {
     try {
       const { publicAddress } = user;
       const poll = await Poll.findById(pollId);
       if (!poll) { throw new NotFoundError('Poll'); }
       if (!poll.contractAddress) { throw new ValidationError('Poll contract not deployed'); }
       if (poll.creator.toLowerCase() !== publicAddress.toLowerCase()) { throw new AuthorizationError('Only the poll creator can reactivate a poll'); }
       const result = await this.contractService.reactivatePoll( poll.contractAddress, duration );
       poll.isActive = true;
       if (duration > 0) { poll.duration = duration; poll.endTime = new Date(Date.now() + (duration * 1000)); }
       else { poll.endTime = null; }
       await poll.save();
       logger.info(`Poll ${pollId} reactivated by ${publicAddress}`);
       return result;
     } catch (error) {
       logger.error(`Error reactivating poll ${pollId}: ${error.message}`);
       if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof AuthorizationError) { throw error; }
       throw new BlockchainError('Failed to reactivate poll', error);
     }
   }

  // --- getReceivedRewards method (unchanged from your provided code) ---
  async getReceivedRewards(userAddress) {
     try {
       const polls = await Poll.find({ hasRewards: true });
       logger.info(`Checking received rewards for user ${userAddress} across ${polls.length} polls`);
       const receivedRewards = await Promise.all(
         polls.map(async (poll) => {
           try {
             const hasVoted = await this.contractService.hasUserVoted(poll.contractAddress, userAddress);
             const hasReceivedReward = await this.contractService.hasUserReceivedReward(poll.contractAddress, userAddress);
             return { pollId: poll._id, pollAddress: poll.contractAddress, pollTitle: poll.title, hasVoted, hasReceivedReward, rewardAmount: poll.rewardPerVoter };
           } catch (error) {
             logger.error(`Error checking rewards for poll ${poll._id}: ${error.message}`);
             return { pollId: poll._id, pollAddress: poll.contractAddress, pollTitle: poll.title, hasVoted: false, hasReceivedReward: false, rewardAmount: poll.rewardPerVoter, error: 'Failed to check reward status' };
           }
         })
       );
       return receivedRewards.filter(reward => reward.hasVoted);
     } catch (error) {
       logger.error(`Error getting received rewards for ${userAddress}: ${error.message}`);
       throw new Error('Failed to get received rewards');
     }
   }

  // --- getUserNonce method (unchanged from your provided code) ---
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

  // --- searchPolls method (unchanged from your provided code) ---
   async searchPolls(query) {
     try {
       if (!query) { throw new ValidationError('Please provide a search query'); }
       const polls = await Poll.find({
         $or: [
           { title: { $regex: query, $options: 'i' } },
           { description: { $regex: query, $options: 'i' } },
           { tags: { $in: [new RegExp(query, 'i')] } }
         ]
       }).limit(10);
       logger.info(`Search for "${query}" returned ${polls.length} results`);
       polls.forEach(poll => { if (poll.image && !poll.imageUrl) { poll.imageUrl = `${getS3BaseUrl()}${poll.image}`; } });
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
       if (error instanceof ValidationError) { throw error; }
       throw new Error('Failed to search polls');
     }
   }

} // End PollService Class

module.exports = PollService;