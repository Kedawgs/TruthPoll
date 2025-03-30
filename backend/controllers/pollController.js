// backend/controllers/pollController.js
const { successResponse, paginatedResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

/**
 * @desc    Create a new poll
 * @route   POST /api/polls
 * @access  Private
 */
exports.createPoll = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    const pollData = {
      title: req.body.title,
      description: req.body.description,
      options: req.body.options,
      creator: req.body.creator,
      duration: req.body.duration,
      category: req.body.category,
      tags: req.body.tags,
      rewardPerVoter: req.body.rewardPerVoter
    };
    
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
      search: req.query.search || null
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
    
    const voteData = {
      optionIndex: req.body.optionIndex,
      voterAddress: req.body.voterAddress,
      signature: req.body.signature
    };
    
    const result = await pollService.votePoll(req.params.id, voteData, req.user);
    
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
 * @desc    Claim reward for a poll
 * @route   POST /api/polls/claim-reward
 * @access  Private
 */
exports.claimReward = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    const { pollAddress, signature } = req.body;
    
    const result = await pollService.claimReward(
      pollAddress,
      signature,
      req.user
    );
    
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get claimable rewards for a user
 * @route   GET /api/polls/claimable-rewards/:address
 * @access  Public
 */
exports.getClaimableRewards = async (req, res, next) => {
  try {
    // Get the poll service from app.locals
    const pollService = req.app.locals.pollService;
    
    const userAddress = req.params.address;
    
    const claimableRewards = await pollService.getClaimableRewards(userAddress);
    
    return successResponse(res, claimableRewards);
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
    
    const { query } = req.query;
    
    if (!query || query.trim().length < 1) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a search query'
      });
    }
    
    const polls = await pollService.searchPolls(query);
    
    return successResponse(res, polls);
  } catch (error) {
    next(error);
  }
};