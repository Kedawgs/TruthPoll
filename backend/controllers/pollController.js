// backend/controllers/pollController.js
const { successResponse, paginatedResponse } = require('../utils/responseHandler');
const { NotFoundError, AuthorizationError, BlockchainError } = require('../utils/errorTypes');
const logger = require('../utils/logger');
const { getS3BaseUrl } = require('../utils/s3Utils');

/**
 * @desc    Create a new poll
 * @route   POST /api/polls
 * @access  Private
 */
exports.createPoll = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    // Input validation and sanitization is handled by the middleware
    const pollData = req.body;
    
    // If image key is provided, add the S3 URL
    if (pollData.image) {
      // Create the full S3 URL for the image
      pollData.imageUrl = `${getS3BaseUrl()}${pollData.image}`;
    }
    
    const result = await pollService.createPoll(pollData);
    
    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all polls
 * @route   GET /api/polls
 * @access  Public
 */
exports.getPolls = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    // Parse query parameters
    const options = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 10,
      category: req.query.category || null,
      creator: req.query.creator || null,
      active: req.query.active || null,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
      search: req.query.search || null,
      hasRewards: req.query.hasRewards || null
    };
    
    const result = await pollService.getPolls(options);
    
    return paginatedResponse(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single poll
 * @route   GET /api/polls/:id
 * @access  Public
 */
exports.getPoll = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    const pollData = await pollService.getPoll(req.params.id);
    
    // If poll has an image key but no imageUrl, add it
    if (pollData.data && pollData.data.image && !pollData.data.imageUrl) {
      pollData.data.imageUrl = `${getS3BaseUrl()}${pollData.data.image}`;
    }
    
    return successResponse(res, pollData);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Vote on a poll
 * @route   POST /api/polls/:id/vote
 * @access  Private
 */
exports.votePoll = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    // Input validation is handled by middleware
    const { optionIndex, voterAddress, signature } = req.body;
    
    // Verify address matches for Magic users
    if (req.user && req.user.isMagicUser) {
      if (voterAddress.toLowerCase() !== req.user.publicAddress.toLowerCase()) {
        return next(new AuthorizationError('Cannot vote as another address'));
      }
    }
    
    const result = await pollService.votePoll(req.params.id, {
      optionIndex,
      voterAddress,
      signature
    }, req.user);
    
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    End a poll
 * @route   PUT /api/polls/:id/end
 * @access  Private
 */
exports.endPoll = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    // Get poll details first to verify ownership
    const pollData = await pollService.getPoll(req.params.id);
    
    // Verify poll exists
    if (!pollData || !pollData.data) {
      return next(new NotFoundError('Poll not found'));
    }
    
    // Check if the user is the poll creator for Magic users
    if (req.user && req.user.isMagicUser) {
      if (pollData.data.creator.toLowerCase() !== req.user.publicAddress.toLowerCase()) {
        return next(new AuthorizationError('Only the poll creator can end a poll'));
      }
    }
    
    const result = await pollService.endPoll(req.params.id, req.user);
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reactivate a poll
 * @route   PUT /api/polls/:id/reactivate
 * @access  Private
 */
exports.reactivatePoll = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    // Get poll details first to verify ownership
    const pollData = await pollService.getPoll(req.params.id);
    
    // Verify poll exists
    if (!pollData || !pollData.data) {
      return next(new NotFoundError('Poll not found'));
    }
    
    // Check if the user is the poll creator for Magic users
    if (req.user && req.user.isMagicUser) {
      if (pollData.data.creator.toLowerCase() !== req.user.publicAddress.toLowerCase()) {
        return next(new AuthorizationError('Only the poll creator can reactivate a poll'));
      }
    }
    
    // Duration is validated by middleware
    const { duration = 0 } = req.body;
    
    const result = await pollService.reactivatePoll(
      req.params.id, 
      duration,
      req.user
    );
    
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get rewards received by a user
 * @route   GET /api/polls/received-rewards/:address
 * @access  Public
 */
exports.getReceivedRewards = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    const userAddress = req.params.address;
    
    // For Magic users, verify they're only accessing their own rewards
    if (req.user && req.user.isMagicUser) {
      if (userAddress.toLowerCase() !== req.user.publicAddress.toLowerCase()) {
        return next(new AuthorizationError('Can only view rewards for your own address'));
      }
    }
    
    const receivedRewards = await pollService.getReceivedRewards(userAddress);
    
    return successResponse(res, receivedRewards);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's nonce for a poll (for signing)
 * @route   GET /api/polls/nonce/:pollAddress/:userAddress
 * @access  Public
 */
exports.getUserNonce = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    const { pollAddress, userAddress } = req.params;
    
    // For Magic users, verify they're only accessing their own nonce
    if (req.user && req.user.isMagicUser) {
      if (userAddress.toLowerCase() !== req.user.publicAddress.toLowerCase()) {
        return next(new AuthorizationError('Can only get nonce for your own address'));
      }
    }
    
    const nonceData = await pollService.getUserNonce(pollAddress, userAddress);
    
    return successResponse(res, nonceData);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search polls
 * @route   GET /api/polls/search
 * @access  Public
 */
exports.searchPolls = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    // Validation is handled by middleware
    const { query } = req.query;
    
    const polls = await pollService.searchPolls(query);
    
    // Add S3 image URLs if needed
    if (polls && polls.length > 0) {
      polls.forEach(poll => {
        if (poll.image && !poll.imageUrl) {
          poll.imageUrl = `${getS3BaseUrl()}${poll.image}`;
        }
      });
    }
    
    return successResponse(res, polls);
  } catch (error) {
    next(error);
  }
};