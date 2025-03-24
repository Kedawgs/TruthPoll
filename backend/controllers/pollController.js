// backend/controllers/pollController.js
const Poll = require('../models/Poll');
const ethers = require('ethers');
const ContractService = require('../services/contractService');
const RelayerService = require('../services/relayerService');
const SmartWalletService = require('../services/smartWalletService');

// Create provider
const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);

// Initialize services
const contractService = new ContractService(provider);
const relayerService = new RelayerService(provider, process.env.PLATFORM_WALLET_PRIVATE_KEY);
const smartWalletService = new SmartWalletService(provider, process.env.PLATFORM_WALLET_PRIVATE_KEY);

// Create a new poll
exports.createPoll = async (req, res) => {
  try {
    const { 
      title, description, options, creator, 
      duration = 0, category = 'General', tags = [],
      rewardPerVoter = 0
    } = req.body;
    const { isMagicUser } = req.user || {};

    console.log("Creating poll with data:", { 
      title, description, options, creator, 
      duration, category, tags, rewardPerVoter 
    });

    // Validate input
    if (!title || !options || options.length < 2 || !creator) {
      return res.status(400).json({
        success: false,
        error: 'Please provide title, at least two options, and creator address'
      });
    }

    // Check if contract service is initialized
    if (!contractService.factoryContract) {
      console.error("Factory contract not initialized. Check FACTORY_ADDRESS in .env");
      return res.status(500).json({
        success: false,
        error: 'Contract service not properly initialized'
      });
    }

    console.log("Creating poll on blockchain...");
    
    // Create the poll on the blockchain
    const result = await contractService.createPoll(
      title, options, duration, rewardPerVoter
    );
    
    console.log("Poll created on blockchain:", result);

    console.log("Saving poll to database...");
    // Create the poll in the database
    const poll = await Poll.create({
      title,
      description,
      options,
      creator,
      contractAddress: result.pollAddress,
      duration,
      category,
      tags,
      hasRewards: rewardPerVoter > 0,
      rewardPerVoter: rewardPerVoter
    });
    console.log("Poll saved to database:", poll._id);

    res.status(201).json({
      success: true,
      data: poll,
      transactionHash: result.transactionHash
    });
  } catch (error) {
    console.error('Error creating poll:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

// Get all polls
exports.getPolls = async (req, res) => {
  try {
    // Parse query parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const category = req.query.category || null;
    const creator = req.query.creator || null;
    const isActive = req.query.active === 'true';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search || null;

    // Build query
    const query = {};
    if (category) query.category = category;
    if (creator) query.creator = creator;
    if (req.query.active !== undefined) query.isActive = isActive;

    // Add search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder;

    // Execute query
    const polls = await Poll.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Poll.countDocuments(query);

    res.status(200).json({
      success: true,
      count: polls.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        total
      },
      data: polls
    });
  } catch (error) {
    console.error('Error getting polls:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

// Get a single poll
exports.getPoll = async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({
        success: false,
        error: 'Poll not found'
      });
    }

    // Get on-chain data
    if (poll.contractAddress) {
      try {
        const onChainData = await contractService.getPollDetails(poll.contractAddress);
        
        // Combine database and blockchain data
        const pollData = {
          ...poll.toObject(),
          onChain: onChainData
        };
        
        res.status(200).json({
          success: true,
          data: pollData
        });
      } catch (error) {
        console.error('Error fetching on-chain data:', error);
        
        // Return just the database data if blockchain fetch fails
        res.status(200).json({
          success: true,
          data: poll,
          blockchainError: 'Failed to fetch on-chain data'
        });
      }
    } else {
      res.status(200).json({
        success: true,
        data: poll
      });
    }
  } catch (error) {
    console.error('Error getting poll:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

// Vote on a poll - unified handler for both Magic and non-Magic users
exports.votePoll = async (req, res) => {
  try {
    console.log("====== VOTE POLL REQUEST RECEIVED ======");
    console.log("Poll ID:", req.params.id);
    console.log("Request body:", req.body);
    console.log("Auth user:", req.user);
    
    const { optionIndex, voterAddress, signature } = req.body;
    const { isMagicUser } = req.user || {};

    console.log("Parsed vote data:", { 
      optionIndex, 
      voterAddress, 
      signatureLength: signature?.length,
      isMagicUser 
    });

    if (optionIndex === undefined || !voterAddress || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Please provide option index, voter address, and signature'
      });
    }

    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({
        success: false,
        error: 'Poll not found'
      });
    }

    if (!poll.contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Poll contract not deployed'
      });
    }

    console.log("Poll found in database:", {
      id: poll._id,
      title: poll.title,
      contractAddress: poll.contractAddress,
      creator: poll.creator
    });

    // Check if user is the poll creator
    const isCreator = poll.creator.toLowerCase() === voterAddress.toLowerCase();
    console.log("Is voter the creator?", isCreator);
    
    if (isCreator) {
      return res.status(400).json({
        success: false,
        error: 'Poll creator cannot vote on their own poll'
      });
    }

    // For Magic users, verify user is authenticated
    if (isMagicUser) {
      console.log("Authenticated Magic user:", req.user.publicAddress);
      console.log("Voter address:", voterAddress);
      
      if (req.user.publicAddress.toLowerCase() !== voterAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized voting address'
        });
      }
      
      console.log("Handling Magic user vote");
      
      try {
        // For testing, try direct vote first
        /*
        console.log("TESTING: Attempting direct vote by platform wallet");
        const directResult = await relayerService.directVote(
          poll.contractAddress,
          optionIndex
        );
        console.log("Direct vote result:", directResult);
        */
        
        // Relay the transaction 
        console.log("Relaying Magic vote transaction");
        const result = await relayerService.relayMagicVote(
          poll.contractAddress,
          voterAddress,
          optionIndex,
          signature
        );
        
        console.log("Relay vote result:", result);
        
        res.status(200).json({
          success: true,
          data: result
        });
      } catch (relayError) {
        console.error("Error in vote relay:", relayError);
        console.error("Stack trace:", relayError.stack);
        
        // Try to provide a more helpful error message
        let errorMessage = relayError.message || 'Server Error';
        
        if (errorMessage.includes("Poll creator cannot vote")) {
          errorMessage = "Poll creator cannot vote on their own poll";
        } else if (errorMessage.includes("Already voted")) {
          errorMessage = "You have already voted on this poll";
        } else if (errorMessage.includes("Poll is not active")) {
          errorMessage = "This poll is not active";
        } else if (errorMessage.includes("Poll has ended")) {
          errorMessage = "This poll has ended";
        } else if (errorMessage.includes("Invalid option")) {
          errorMessage = "Invalid option selected";
        } else if (errorMessage.includes("Invalid signature")) {
          errorMessage = "Invalid signature. Please try again.";
        }

        return res.status(500).json({
          success: false,
          error: errorMessage,
          originalError: relayError.message
        });
      }
    } else {
      console.log("Handling non-Magic user vote");
      
      // For non-Magic users - use smart wallet
      try {
        const smartWalletAddress = await smartWalletService.deployWalletIfNeeded(voterAddress);
        console.log("Smart wallet address:", smartWalletAddress);
        
        // Relay through smart wallet
        const result = await relayerService.relaySmartWalletVote(
          smartWalletAddress,
          poll.contractAddress,
          optionIndex,
          signature
        );
        
        console.log("Smart wallet vote result:", result);
        
        res.status(200).json({
          success: true,
          data: result
        });
      } catch (walletError) {
        console.error("Error in smart wallet vote:", walletError);
        console.error("Stack trace:", walletError.stack);
        
        return res.status(500).json({
          success: false,
          error: walletError.message || 'Failed to vote using smart wallet'
        });
      }
    }
  } catch (error) {
    console.error('Error voting on poll:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

// End a poll
exports.endPoll = async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    const { isMagicUser } = req.user || {};
    const userAddress = isMagicUser ? req.user.publicAddress : null;

    if (!poll) {
      return res.status(404).json({
        success: false,
        error: 'Poll not found'
      });
    }

    if (!poll.contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Poll contract not deployed'
      });
    }

    // Verify poll creator for Magic users
    if (isMagicUser && poll.creator.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Only the poll creator can end a poll'
      });
    }

    // End the poll via the contract service
    const result = await contractService.endPoll(poll.contractAddress);

    // Update the poll in the database
    poll.isActive = false;
    await poll.save();

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error ending poll:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

// Reactivate a poll
exports.reactivatePoll = async (req, res) => {
  try {
    const { duration = 0 } = req.body;
    const { isMagicUser } = req.user || {};
    const userAddress = isMagicUser ? req.user.publicAddress : null;
    
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({
        success: false,
        error: 'Poll not found'
      });
    }

    if (!poll.contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Poll contract not deployed'
      });
    }

    // Verify poll creator for Magic users
    if (isMagicUser && poll.creator.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Only the poll creator can reactivate a poll'
      });
    }

    // Reactivate the poll via the contract service
    const result = await contractService.reactivatePoll(
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

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error reactivating poll:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

// Handle reward claims
exports.claimReward = async (req, res) => {
  try {
    const { pollAddress, signature } = req.body;
    const { isMagicUser } = req.user || {};
    const userAddress = req.user.publicAddress;

    if (!pollAddress || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Please provide poll address and signature'
      });
    }

    // For Magic users, relay directly
    if (isMagicUser) {
      console.log("Handling Magic user reward claim");
      const result = await relayerService.relayMagicRewardClaim(
        pollAddress,
        userAddress,
        signature
      );
      
      res.status(200).json({
        success: true,
        data: result
      });
    } else {
      console.log("Handling non-Magic user reward claim");
      // For non-Magic users - use smart wallet
      const smartWalletAddress = await smartWalletService.getWalletAddress(userAddress);
      
      // Relay through smart wallet
      const result = await relayerService.relaySmartWalletRewardClaim(
        smartWalletAddress,
        pollAddress,
        signature
      );
      
      res.status(200).json({
        success: true,
        data: result
      });
    }
  } catch (error) {
    console.error('Error claiming reward:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

// Get claimable rewards for a user
exports.getClaimableRewards = async (req, res) => {
  try {
    const userAddress = req.params.address;
    
    // Find all polls
    const polls = await Poll.find({ hasRewards: true });
    
    // Check which rewards are claimable
    const claimableRewards = await Promise.all(
      polls.map(async (poll) => {
        const canClaim = await contractService.canClaimReward(poll.contractAddress, userAddress);
        const hasVoted = await contractService.hasUserVoted(poll.contractAddress, userAddress);
        
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
    
    res.status(200).json({
      success: true,
      data: claimableRewards.filter(reward => reward.hasVoted)
    });
  } catch (error) {
    console.error('Error getting claimable rewards:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

// Get user's nonce for a poll (for signing)
exports.getUserNonce = async (req, res) => {
  try {
    const { pollAddress, userAddress } = req.params;
    
    const nonce = await contractService.getUserNonce(pollAddress, userAddress);
    
    res.status(200).json({
      success: true,
      data: { nonce }
    });
  } catch (error) {
    console.error('Error getting user nonce:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

// Search polls
exports.searchPolls = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a search query'
      });
    }

    // Search in title, description, and tags
    const polls = await Poll.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    });

    res.status(200).json({
      success: true,
      count: polls.length,
      data: polls
    });
  } catch (error) {
    console.error('Error searching polls:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};