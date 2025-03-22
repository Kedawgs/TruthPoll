const mongoose = require('mongoose');

// Define the ProxyWallet schema
const ProxyWalletSchema = new mongoose.Schema({
  userAddress: {
    type: String,
    required: [true, 'Please add a user address'],
    unique: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please add a valid Ethereum address']
  },
  proxyAddress: {
    type: String,
    required: [true, 'Please add a proxy address'],
    unique: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please add a valid Ethereum address']
  },
  encryptedPrivateKey: {
    type: String,
    required: [true, 'Please add an encrypted private key']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  balance: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('ProxyWallet', ProxyWalletSchema);