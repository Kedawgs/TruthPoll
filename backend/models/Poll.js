const mongoose = require('mongoose');

// Define the Poll schema
const PollSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  options: {
    type: [String],
    required: [true, 'Please add options'],
    validate: {
      validator: function(v) {
        return v.length >= 2;
      },
      message: 'Poll must have at least 2 options'
    }
  },
  creator: {
    type: String,
    required: [true, 'Please add creator address'],
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please add a valid Ethereum address']
  },
  contractAddress: {
    type: String,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please add a valid contract address']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number, // Duration in seconds, 0 means no end time
    default: 0
  },
  endTime: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    enum: ['General', 'Politics', 'Technology', 'Sports', 'Entertainment', 'Other'],
    default: 'General'
  },
  tags: {
    type: [String]
  }
});

// Middleware: Calculate endTime based on duration before saving
PollSchema.pre('save', function(next) {
  if (this.duration > 0 && !this.endTime) {
    const durationMs = this.duration * 1000; // Convert seconds to milliseconds
    this.endTime = new Date(this.createdAt.getTime() + durationMs);
  }
  next();
});

module.exports = mongoose.model('Poll', PollSchema);