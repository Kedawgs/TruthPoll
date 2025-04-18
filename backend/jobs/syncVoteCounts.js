// backend/jobs/syncVoteCounts.js
const Poll = require('../models/Poll');
const ContractService = require('../services/contractService');
const logger = require('../utils/logger');
const { ethers } = require('ethers');
const dotenv = require('dotenv');

dotenv.config();

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);

// Initialize contract service
const contractService = new ContractService(
  provider,
  process.env.PLATFORM_WALLET_PRIVATE_KEY
);

/**
 * Sync vote counts from blockchain to database
 * This job should be run periodically (e.g., every hour)
 */
async function syncVoteCounts() {
  try {
    logger.info('Starting vote count sync job');
    
    // Find all polls with contract addresses
    const polls = await Poll.find({ contractAddress: { $exists: true, $ne: null } });
    
    logger.info(`Found ${polls.length} polls to sync`);
    
    // Define batch size for processing
    const batchSize = 5;
    
    // Process polls in batches to avoid overloading the RPC provider
    for (let i = 0; i < polls.length; i += batchSize) {
      const batch = polls.slice(i, i + batchSize);
      
      // Process batch in parallel
      await Promise.all(
        batch.map(async (poll) => {
          try {
            // Get on-chain poll details
            const onChainData = await contractService.getPollDetails(poll.contractAddress);
            
            // Update cached vote count
            if (onChainData && onChainData.totalVotes !== undefined) {
              const totalVotes = parseInt(onChainData.totalVotes);
              
              // Only update if on-chain data differs from cached data
              if (poll.cachedVoteCount !== totalVotes) {
                logger.info(`Updating vote count for poll ${poll._id} from ${poll.cachedVoteCount} to ${totalVotes}`);
                
                poll.cachedVoteCount = totalVotes;
                poll.lastVoteSync = new Date();
                await poll.save();
              }
            }
          } catch (error) {
            logger.error(`Error syncing vote count for poll ${poll._id}: ${error.message}`);
          }
        })
      );
      
      // Add a small delay between batches to avoid overwhelming the RPC provider
      if (i + batchSize < polls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.info('Vote count sync job completed');
  } catch (error) {
    logger.error(`Error in vote count sync job: ${error.message}`);
  }
}

// Export for use in scheduled tasks
module.exports = syncVoteCounts;

// If running directly, execute the job
if (require.main === module) {
  syncVoteCounts()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error(`Error in vote count sync job: ${error.message}`);
      process.exit(1);
    });
}