// backend/controllers/contractController.js
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * @desc    Deploy factory contract
 * @route   POST /api/contracts/deploy-factory
 * @access  Public (should be restricted in production)
 */
exports.deployFactory = async (req, res) => {
  try {
    // Get contract service from app.locals
    const contractService = req.app.locals.contractService;
    
    const factoryAddress = await contractService.deployFactory();
    
    // Save the factory address to .env.local
    const envLocalPath = path.join(__dirname, '..', '.env.local');
    const envData = `FACTORY_ADDRESS=${factoryAddress}\n`;
    
    fs.writeFileSync(envLocalPath, envData, { flag: 'a' });
    
    res.status(200).json({
      success: true,
      data: {
        factoryAddress,
        message: "Factory address saved to .env.local file. Update your main .env file."
      }
    });
  } catch (error) {
    logger.error('Error deploying factory:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Get polls by creator
 * @route   GET /api/contracts/polls/creator/:address
 * @access  Public
 */
exports.getPollsByCreator = async (req, res) => {
  try {
    // Get contract service from app.locals
    const contractService = req.app.locals.contractService;
    
    const creatorAddress = req.params.address;
    
    const pollAddresses = await contractService.getPollsByCreator(creatorAddress);
    
    // Get details for each poll
    const pollDetails = await Promise.all(
      pollAddresses.map(async (address) => {
        try {
          return {
            address,
            details: await contractService.getPollDetails(address)
          };
        } catch (error) {
          logger.error(`Error fetching details for poll ${address}:`, error);
          return {
            address,
            error: 'Failed to fetch details'
          };
        }
      })
    );
    
    res.status(200).json({
      success: true,
      count: pollDetails.length,
      data: pollDetails
    });
  } catch (error) {
    logger.error('Error getting polls by creator:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Get all polls from blockchain
 * @route   GET /api/contracts/polls
 * @access  Public
 */
exports.getAllPolls = async (req, res) => {
  try {
    // Get contract service from app.locals
    const contractService = req.app.locals.contractService;
    
    const pollAddresses = await contractService.getAllPolls();
    
    res.status(200).json({
      success: true,
      count: pollAddresses.length,
      data: pollAddresses
    });
  } catch (error) {
    logger.error('Error getting all polls:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

/**
 * @desc    Get poll details from blockchain
 * @route   GET /api/contracts/polls/:address
 * @access  Public
 */
exports.getPollDetails = async (req, res) => {
  try {
    // Get contract service from app.locals
    const contractService = req.app.locals.contractService;
    
    const pollAddress = req.params.address;
    
    const pollDetails = await contractService.getPollDetails(pollAddress);
    
    res.status(200).json({
      success: true,
      data: pollDetails
    });
  } catch (error) {
    logger.error('Error getting poll details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};