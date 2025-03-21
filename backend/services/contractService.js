const ethers = require('ethers');

// We'll require the ABI artifacts after compiling the contracts
// For now, let's define placeholders that we'll update later
let PollFactoryABI = [];
let PollABI = [];

/**
 * Service for interacting with blockchain contracts
 */
class ContractService {
  /**
   * Initialize the service
   * @param {object} provider - An ethers.js provider
   */
  constructor(provider) {
    this.provider = provider;
    this.factoryAddress = process.env.FACTORY_ADDRESS;
    this.platformWallet = new ethers.Wallet(
      process.env.PLATFORM_WALLET_PRIVATE_KEY,
      provider
    );
    
    // Default gas settings for Polygon Amoy testnet
    this.gasSettings = {
      maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei"),
      maxFeePerGas: ethers.utils.parseUnits("35", "gwei"),
      gasLimit: 3000000
    };
    
    // Try to load contract ABIs if they exist
    try {
      PollFactoryABI = require('../artifacts/contracts/PollFactory.sol/PollFactory.json').abi;
      PollABI = require('../artifacts/contracts/Poll.sol/Poll.json').abi;
      
      // Initialize the factory contract if the address is available
      if (this.factoryAddress) {
        this.factoryContract = new ethers.Contract(
          this.factoryAddress,
          PollFactoryABI,
          this.platformWallet
        );
      }
    } catch (error) {
      console.log('Contract artifacts not found. Compile contracts first.');
    }
  }

  /**
   * Deploy the factory contract
   * @return {string} Deployed contract address
   */
  async deployFactory() {
    try {
      // Create a factory for the contract
      const contractFactory = await ethers.getContractFactory(
        'PollFactory',
        this.platformWallet
      );
      
      // Deploy the contract with proper gas settings
      console.log('Deploying PollFactory...');
      const factory = await contractFactory.deploy(this.gasSettings);
      
      // Wait for deployment to finish
      await factory.deployed();
      
      console.log('PollFactory deployed to:', factory.address);
      
      // Update the factory address and contract instance
      this.factoryAddress = factory.address;
      this.factoryContract = factory;
      
      return factory.address;
    } catch (error) {
      console.error('Error deploying factory contract:', error);
      throw error;
    }
  }

  /**
   * Create a new poll
   * @param {string} title - Poll title
   * @param {string[]} options - Array of poll options
   * @param {number} duration - Duration in seconds (0 for no end time)
   * @return {object} Transaction details and poll address
   */
  async createPoll(title, options, duration = 0) {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      // Create the poll with proper gas settings
      const tx = await this.factoryContract.createPoll(
        title,
        options,
        duration,
        this.gasSettings
      );
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      
      // Extract the poll address from the event
      const event = receipt.events.find(e => e.event === 'PollCreated');
      const pollAddress = event.args.pollAddress;
      
      return {
        transactionHash: receipt.transactionHash,
        pollAddress
      };
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }

  /**
   * Get poll details from the blockchain
   * @param {string} pollAddress - Address of the poll contract
   * @return {object} Poll details
   */
  async getPollDetails(pollAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        PollABI,
        this.provider
      );
      
      // Get poll data
      const title = await pollContract.title();
      const options = await pollContract.getOptions();
      const isActive = await pollContract.isPollActive();
      const results = await pollContract.getResults();
      const totalVotes = await pollContract.totalVotes();
      const creationTime = await pollContract.creationTime();
      const endTime = await pollContract.endTime();
      const owner = await pollContract.owner();
      
      // Format the results
      const formattedResults = results.map(r => r.toNumber());
      
      return {
        title,
        options,
        isActive,
        results: formattedResults,
        totalVotes: totalVotes.toNumber(),
        creationTime: new Date(creationTime.toNumber() * 1000),
        endTime: endTime.toNumber() > 0 ? new Date(endTime.toNumber() * 1000) : null,
        owner
      };
    } catch (error) {
      console.error('Error getting poll details:', error);
      throw error;
    }
  }

  /**
   * Vote on a poll
   * @param {string} pollAddress - Address of the poll contract
   * @param {number} option - Option index to vote for
   * @param {string} userAddress - The user's address
   * @return {object} Transaction details
   */
  async votePoll(pollAddress, option, userAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        PollABI,
        this.platformWallet
      );
      
      // Check if the user has already voted
      const hasVoted = await pollContract.hasVoted(userAddress);
      
      if (hasVoted) {
        throw new Error('User has already voted on this poll');
      }
      
      // Check if user is the poll creator
      const owner = await pollContract.owner();
      if (owner.toLowerCase() === userAddress.toLowerCase()) {
        throw new Error('Poll creator cannot vote on their own poll');
      }
      
      // Vote on the poll with proper gas settings
      const tx = await pollContract.vote(option, this.gasSettings);
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      console.error('Error voting on poll:', error);
      throw error;
    }
  }

  /**
   * End a poll (owner only)
   * @param {string} pollAddress - Address of the poll contract
   * @return {object} Transaction details
   */
  async endPoll(pollAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        PollABI,
        this.platformWallet
      );
      
      // End the poll with proper gas settings
      const tx = await pollContract.endPoll(this.gasSettings);
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      console.error('Error ending poll:', error);
      throw error;
    }
  }

  /**
   * Reactivate a poll (owner only)
   * @param {string} pollAddress - Address of the poll contract
   * @param {number} newDuration - New duration in seconds (0 for no end time)
   * @return {object} Transaction details
   */
  async reactivatePoll(pollAddress, newDuration = 0) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        PollABI,
        this.platformWallet
      );
      
      // Reactivate the poll with proper gas settings
      const tx = await pollContract.reactivatePoll(newDuration, this.gasSettings);
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      console.error('Error reactivating poll:', error);
      throw error;
    }
  }

  /**
   * Get polls created by a user
   * @param {string} creatorAddress - Creator's address
   * @return {string[]} Array of poll addresses
   */
  async getPollsByCreator(creatorAddress) {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      const pollAddresses = await this.factoryContract.getPollsByCreator(creatorAddress);
      return pollAddresses;
    } catch (error) {
      console.error('Error getting polls by creator:', error);
      throw error;
    }
  }

  /**
   * Get all deployed polls
   * @return {string[]} Array of poll addresses
   */
  async getAllPolls() {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      const pollAddresses = await this.factoryContract.getDeployedPolls();
      return pollAddresses;
    } catch (error) {
      console.error('Error getting all polls:', error);
      throw error;
    }
  }
}

module.exports = ContractService;