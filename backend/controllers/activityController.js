// backend/controllers/activityController.js
const Activity = require('../models/Activity');
const { successResponse, paginatedResponse } = require('../utils/responseHandler');
const { getS3BaseUrl } = require('../utils/s3Utils');

// Get activity feed
exports.getActivities = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    
    const activities = await Activity.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Activity.countDocuments();
    
    // Format response with complete URLs
    const formattedActivities = activities.map(activity => ({
      _id: activity._id,
      userAddress: activity.userAddress,
      username: activity.username,
      avatarUrl: activity.avatar ? `${getS3BaseUrl()}${activity.avatar}` : null,
      type: activity.type,
      pollId: activity.pollId,
      pollTitle: activity.pollTitle,
      timestamp: activity.timestamp
    }));
    
    return paginatedResponse(res, {
      data: formattedActivities,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (error) {
    next(error);
  }
};

// Helper to create activity
exports.createActivity = async (data) => {
  try {
    const activity = await Activity.create(data);
    return activity;
  } catch (error) {
    console.error('Error creating activity:', error);
    throw error;
  }
};