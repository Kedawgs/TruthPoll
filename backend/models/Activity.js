// backend/models/Activity.js
const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  userAddress: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please add a valid Ethereum address']
  },
  username: String,
  avatar: String,
  type: {
    type: String,
    enum: ['Created', 'Voted on'],
    required: true
  },
  pollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll',
    required: true
  },
  pollTitle: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for better performance
ActivitySchema.index({ timestamp: -1 });
ActivitySchema.index({ userAddress: 1 });

module.exports = mongoose.model('Activity', ActivitySchema);