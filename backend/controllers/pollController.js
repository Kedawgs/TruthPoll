const Poll = require('../models/Poll');
const ethers = require('ethers');
const ContractService = require('../services/contractService');

// Create provider
const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);

// Initialize contract service
const contractService = new ContractService(provider);

/**
 * @desc    Create a new poll
 * @route   POST /api/polls
 * @access  Public
 */
exports.createPoll = async (req, res) => {
  try {
    const { title, description, options, creator, duration = 0, category = 'General', tags = [] } = req.body;

    console.log("Creating poll with data:", { title, description, options, creator, duration, category, tags });

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
    const result = await contractService.createPoll(title, options, duration);
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
      tags
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

/**
 * @desc    Get all polls
 * @route   GET /api/polls
 * @access  Public
 */
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

    // Build query
    const query = {};
    if (category) query.category = category;
    if (creator) query.creator = creator;
    if (req.query.active !== undefined) query.isActive = isActive;

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

/**
 * @desc    Get a single poll
 * @route   GET /api/polls/:id
 * @access  Public
 */
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

/**
 * @desc    Vote on a poll
 * @route   POST /api/polls/:id/vote
 * @access  Public
 */
exports.votePoll = async (req, res) => {
  try {
    const { optionIndex, voterAddress } = req.body;

    if (optionIndex === undefined || !voterAddress) {
      return res.status(400).json({
        success: false,
        error: 'Please provide option index and voter address'
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

    // Vote on the poll via the contract service
    const result = await contractService.votePoll(
      poll.contractAddress, 
      optionIndex, 
      voterAddress
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error voting on poll:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    End a poll
 * @route   PUT /api/polls/:id/end
 * @access  Public (should be restricted to owner in a real app)
 */
exports.endPoll = async (req, res) => {
  try {
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

/**
 * @desc    Reactivate a poll
 * @route   PUT /api/polls/:id/reactivate
 * @access  Public (should be restricted to owner in a real app)
 */
exports.reactivatePoll = async (req, res) => {
  try {
    const { duration = 0 } = req.body;
    
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

/**
 * @desc    Search polls
 * @route   GET /api/polls/search
 * @access  Public
 */
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