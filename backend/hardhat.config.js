require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

// Get private key and RPC URL from environment variables
const PRIVATE_KEY = process.env.PLATFORM_WALLET_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const POLYGON_AMOY_RPC_URL = process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
      },
      {
        version: "0.8.20",
      },
      {
        version: "0.8.28",
      }
    ],
  },
  networks: {
    // Polygon Amoy testnet configuration
    polygonAmoy: {
      url: POLYGON_AMOY_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002,  // Polygon Amoy testnet chain ID
    },
    // Local network for testing
    hardhat: {
      // Local Hardhat Network
    }
  },
  // Specify the paths for artifacts, sources, etc.
  paths: {
    artifacts: './artifacts',
    sources: './contracts',
    cache: './cache',
    tests: './test'
  }
};