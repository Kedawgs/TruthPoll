// backend/controllers/userController.js
const User = require('../models/User');
const Poll = require('../models/Poll');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errorTypes');
const { getS3BaseUrl, uploadFile } = require('../utils/s3Utils');

/**
 * @desc    Update or set username with avatar
 * @route   POST /api/users/username
 * @access  Private
 */
exports.setUsername = async (req, res) => {
  try {
    // Input validation and address verification now handled by middleware
    const { username, address, isAutoGenerated } = req.body;
    let avatarKey = null;
    let avatarUrl = null;
    
    // Check if username is already taken by another user
    if (!isAutoGenerated) {
      const existingUser = await User.findOne({ 
        username,
        address: { $ne: address } // Address is already lowercase from validation
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username is already taken'
        });
      }
    } else {
      // For auto-generated usernames, make sure it's unique
      let baseUsername = username;
      let counter = 1;
      let uniqueUsername = baseUsername;
      
      while (true) {
        // Check if this username exists for another user
        const existingUser = await User.findOne({ 
          username: uniqueUsername,
          address: { $ne: address }
        });
        
        if (!existingUser) {
          // Username is unique or belongs to this user
          break;
        }
        
        // Try next number
        uniqueUsername = `${baseUsername}_${counter}`;
        counter++;
      }
      
      // Use the unique username
      req.body.username = uniqueUsername;
    }
    
    // Handle avatar upload if file is provided
    if (req.file) {
      try {
        const { key, url } = await uploadFile(req.file, 'avatars'); // Use a specific folder for avatars
        avatarKey = key;
        avatarUrl = url;
        logger.info(`Avatar uploaded for ${address}, key: ${key}`);
      } catch (uploadError) {
        logger.error(`Error uploading avatar for ${address}:`, uploadError);
        // Continue without avatar if upload fails
      }
    }
    
    // Use findOneAndUpdate with upsert to create or update the user in one atomic operation
    const user = await User.findOneAndUpdate(
      { address }, // Query - address is already lowercase from validation
      { 
        address,
        username: req.body.username,
        isAutoGenerated: !!isAutoGenerated,
        ...(avatarKey && { avatar: avatarKey }),
        ...(avatarUrl && { avatarUrl })
      },
      {
        new: true, // Return the updated document
        upsert: true, // Create if it doesn't exist
        setDefaultsOnInsert: true, // Apply default values if creating
        runValidators: true // Run model validators on update
      }
    );
    
    logger.info(`Username set/updated for address ${address}: ${req.body.username}`);
    
    res.status(200).json({
      success: true,
      data: {
        address: user.address,
        username: user.username,
        isAutoGenerated: user.isAutoGenerated,
        avatarUrl: user.avatarUrl || null,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error(`Error setting username: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile/:address
 * @access  Public
 */
exports.getUserProfile = async (req, res) => {
  try {
    // Address is validated and normalized to lowercase by middleware
    const address = req.params.address;
    
    const user = await User.findOne({ address });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        address: user.address,
        username: user.username,
        isAutoGenerated: user.isAutoGenerated,
        createdAt: user.createdAt,
        avatarUrl: user.avatarUrl || null // Include avatar URL in response
      }
    });
  } catch (error) {
    logger.error(`Error getting user profile: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Get user votes count
 * @route   GET /api/users/votes/:address
 * @access  Public
 */
exports.getUserVotes = async (req, res) => {
  try {
    // Address is validated and normalized to lowercase by middleware
    const address = req.params.address;
    
    // This is a placeholder implementation - in a real scenario, you'd query the blockchain
    // or maintain a votes collection to track votes per user
    
    // For now, we'll count the number of polls where this user has voted
    // by checking the received rewards as a proxy
    const contractService = req.app.locals.contractService;
    
    // Default response (fallback)
    let totalVotes = 0;
    
    // If we have contractService properly initialized
    if (contractService) {
      try {
        // Get all polls
        const pollAddresses = await contractService.getAllPolls();
        
        // Check each poll if the user has voted
        let votedCount = 0;
        await Promise.all(
          pollAddresses.map(async (pollAddress) => {
            try {
              const hasVoted = await contractService.hasUserVoted(pollAddress, address);
              if (hasVoted) {
                votedCount++;
              }
            } catch (error) {
              logger.debug(`Error checking if user ${address} has voted on ${pollAddress}: ${error.message}`);
              // Continue to next poll despite error
            }
          })
        );
        
        totalVotes = votedCount;
      } catch (error) {
        logger.error(`Error fetching user votes from blockchain: ${error.message}`);
        // Continue with default response
      }
    }
    
    // Get polls locally from database where this user is marked as having voted
    try {
      const localPolls = await Poll.find({ 
        "votes.voter": address 
      });
      
      if (localPolls && localPolls.length > 0) {
        // If we found some local votes, use the larger count between
        // blockchain and local database
        totalVotes = Math.max(totalVotes, localPolls.length);
      }
    } catch (dbError) {
      logger.error(`Error fetching local votes: ${dbError.message}`);
      // Continue with blockchain count
    }
    
    res.status(200).json({
      success: true,
      data: {
        address,
        totalVotes
      }
    });
  } catch (error) {
    logger.error(`Error getting user votes: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Get user activity summary - polls created, votes cast, rewards
 * @route   GET /api/users/activity/:address
 * @access  Public
 */
exports.getUserActivity = async (req, res) => {
  try {
    // Address is validated and normalized to lowercase by middleware
    const address = req.params.address;
    
    // Get user profile
    const user = await User.findOne({ address });
    
    // Define response shape
    const activity = {
      address,
      userExists: !!user,
      username: user ? user.username : null,
      avatarUrl: user ? user.avatarUrl : null, // Include avatar URL in activity data
      pollsCreated: 0,
      votesCount: 0,
      rewards: [],
      totalRewardsAmount: 0
    };
    
    // Count polls created by this user
    const pollsCreatedCount = await Poll.countDocuments({ creator: address });
    activity.pollsCreated = pollsCreatedCount;
    
    // Get votes count using existing method
    try {
      const votesData = await this.getUserVotes({ params: { address } }, { 
        status: () => ({ 
          json: (data) => data 
        }) 
      });
      
      if (votesData.success) {
        activity.votesCount = votesData.data.totalVotes;
      }
    } catch (votesError) {
      logger.error(`Error getting votes count: ${votesError.message}`);
      // Continue with other activity data
    }
    
    // Get rewards information
    const contractService = req.app.locals.contractService;
    const pollService = req.app.locals.pollService;
    
    if (pollService) {
      try {
        const rewardsData = await pollService.getReceivedRewards(address);
        
        if (rewardsData && rewardsData.length > 0) {
          // Calculate total rewards amount
          const totalRewards = rewardsData.reduce((total, reward) => {
            const rewardAmount = parseFloat(reward.rewardAmount) || 0;
            return total + rewardAmount;
          }, 0);
          
          activity.totalRewardsAmount = parseFloat(totalRewards.toFixed(2));
          activity.rewards = rewardsData;
        }
      } catch (rewardsError) {
        logger.error(`Error getting rewards for ${address}: ${rewardsError.message}`);
        // Continue with other activity data
      }
    }
    
    res.status(200).json({
      success: true,
      data: activity
    });
  } catch (error) {
    logger.error(`Error getting user activity: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Upload a new avatar for a user
 * @route   POST /api/users/upload-avatar
 * @access  Private
 */
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No avatar file provided'
      });
    }

    // Address is provided in the body and validated by middleware
    const { address } = req.body;
    
    // For Magic users, verify they're only uploading their own avatar
    if (req.user && req.user.isMagicUser) {
      if (address.toLowerCase() !== req.user.publicAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Can only upload avatar for your own address'
        });
      }
    }
    
    // Upload file to S3
    const { key, url } = await uploadFile(req.file, 'avatars');
    
    // Update user with new avatar
    const user = await User.findOneAndUpdate(
      { address: address.toLowerCase() },
      { 
        avatar: key,
        avatarUrl: url
      },
      {
        new: true, // Return updated document
        runValidators: true
      }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    logger.info(`Avatar updated for user ${address}`);
    
    res.status(200).json({
      success: true,
      data: {
        avatar: key,
        avatarUrl: url
      }
    });
  } catch (error) {
    logger.error(`Error uploading avatar: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};