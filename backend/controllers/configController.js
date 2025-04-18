// backend/controllers/configController.js
const configService = require('../services/configService');
const { AuthorizationError } = require('../utils/errorTypes');
const logger = require('../utils/logger');

/**
 * @desc    Get all public configuration values
 * @route   GET /api/config
 * @access  Public
 */
exports.getPublicConfig = async (req, res, next) => {
  try {
    const config = await configService.getAllPublic();
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get specific configuration values (admin only)
 * @route   GET /api/config/admin
 * @access  Admin
 */
exports.getAdminConfig = async (req, res, next) => {
  try {
    // The isAdmin middleware should have already verified admin status
    const config = await configService.getAllPublic();
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update configuration values (admin only)
 * @route   PUT /api/config
 * @access  Admin
 */
exports.updateConfig = async (req, res, next) => {
  try {
    const { key, value, isPublic, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Please provide key and value'
      });
    }
    
    const config = await configService.set(key, value, isPublic, description);
    
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
};