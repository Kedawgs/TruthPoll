// backend/services/contractService.js
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const PollFactory = require('../artifacts/contracts/PollFactory.sol/PollFactory.json');
const Poll = require('../artifacts/contracts/Poll.sol/Poll.json');
const TestUSDT = require('../artifacts/contracts/TestUSDT.sol/TestUSDT.json');
const logger = require('../utils/logger');

class ContractService {
  constructor(provider, platformWalletProvider) {
    this.provider = provider;
    this.platformWalletProvider = platformWalletProvider;
    
    // Default gas settings for Polygon Amoy testnet
    this.gasSettings = {
      maxPriorityFeePerGas: ethers.utils.parseUnits("40", "gwei"),
      maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
      gasLimit: 3000000
    };
    
    // Initialize contracts
    this.factoryAddress = process.env.FACTORY_ADDRESS;
    this.usdtAddress = process.env.USDT_ADDRESS;
    
    if (this.factoryAddress) {
      this.factoryContract = new ethers.Contract(
        this.factoryAddress,
        PollFactory.abi,
        this.provider
      );
      logger.info(`PollFactory initialized at ${this.factoryAddress}`);
    } else {
      logger.warn('PollFactory address not set in environment variables');
    }
  }

  // Create a standard poll without funding
  async createPoll(title, options, duration = 0, rewardPerVoter = 0) {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      logger.info(`Creating poll: ${title}, Options: ${options.length}, Duration: ${duration}, Reward: ${rewardPerVoter}`);
      
      // Parse reward to USDT decimals (6)
      const rewardPerVoterWei = rewardPerVoter > 0 
        ? ethers.utils.parseUnits(rewardPerVoter.toString(), 6) 
        : 0;
      
      // Get signed contract
      const signedFactory = await this.platformWalletProvider.getSignedContract(
        this.factoryAddress,
        PollFactory.abi,
        'create_poll'
      );
      
      // Create the poll with proper gas settings
      const tx = await signedFactory.createPoll(
        title,
        options,
        duration,
        rewardPerVoterWei,
        this.gasSettings
      );
      
      logger.info(`Poll creation transaction submitted: ${tx.hash}`);
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      
      // Extract the poll address from the event
      const event = receipt.events.find(e => e.event === 'PollCreated');
      const pollAddress = event.args.pollAddress;
      
      logger.info(`Poll created at ${pollAddress}`);
      
      return {
        transactionHash: receipt.transactionHash,
        pollAddress
      };
    } catch (error) {
      logger.error('Error creating poll:', error);
      throw error;
    }
  }

  /**
   * Create a new poll with funding in one transaction
   * @param {string} title - Poll title
   * @param {string[]} options - Poll options
   * @param {number} duration - Poll duration in seconds
   * @param {number} rewardPerVoter - USDT reward per voter
   * @param {number} fundAmount - Total USDT amount to fund the poll with
   * @param {string} creator - Creator's address (optional)
   * @param {number} platformFee - Optional explicit platform fee override
   * @returns {Promise<Object>} Creation result with poll address
   */
  async createAndFundPoll(title, options, duration = 0, rewardPerVoter = 0, fundAmount = 0, creator, platformFee = null) {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      // Use provided platform fee or get from contract
      let totalFeeAmount;
      if (platformFee !== null) {
        totalFeeAmount = parseFloat(platformFee);
        logger.info(`Using provided platform fee: ${totalFeeAmount} USDT`);
      } else {
        // Calculate platform fee as contract would (6% of fund amount)
        const feePercent = await this.factoryContract.platformFeePercent();
        totalFeeAmount = (parseFloat(fundAmount) * feePercent.toNumber()) / 10000;
        logger.info(`Calculated platform fee: ${totalFeeAmount} USDT (${feePercent.toNumber()/100}%)`);
      }
      
      // Total amount that will be transferred (fund + fee)
      const totalAmount = parseFloat(fundAmount) + totalFeeAmount;
      
      logger.info(`Creating poll with funding: "${title}", Options: ${options.length}, Duration: ${duration}, Reward: ${rewardPerVoter}, Fund: ${fundAmount}, Fee: ${totalFeeAmount}, Total: ${totalAmount}`);
      
      // Convert numbers to proper format for contract
      const rewardPerVoterWei = ethers.utils.parseUnits(rewardPerVoter.toString(), 6); // USDT has 6 decimals
      const fundAmountWei = ethers.utils.parseUnits(fundAmount.toString(), 6);
      
      // First, ensure USDT is approved by checking current allowance
      const usdtContract = new ethers.Contract(
        this.usdtAddress,
        ["function allowance(address owner, address spender) view returns (uint256)"],
        this.provider
      );
      
      // Convert total amount (fund + fee) to wei
      const totalAmountWei = ethers.utils.parseUnits(totalAmount.toString(), 6);
      
      const currentAllowance = await usdtContract.allowance(creator, this.factoryAddress);
      if (currentAllowance.lt(totalAmountWei)) {
        logger.error(`Insufficient allowance: ${ethers.utils.formatUnits(currentAllowance, 6)} USDT < ${totalAmount} USDT`);
        throw new Error(`Insufficient USDT allowance. Please approve at least ${totalAmount} USDT (${fundAmount} for rewards + ${totalFeeAmount} for platform fees).`);
      }
      
      // Get signed contract
      const signedFactory = await this.platformWalletProvider.getSignedContract(
        this.factoryAddress,
        PollFactory.abi,
        'create_and_fund_poll'
      );
      
      // Get current gas prices for better transaction success
      const feeData = await this.provider.getFeeData();
      
      // Call the createAndFundPoll function with proper gas settings
      const tx = await signedFactory.createAndFundPoll(
        title,
        options,
        duration,
        rewardPerVoterWei,
        fundAmountWei, // This is just the reward amount that will be sent to the poll contract
        {
          gasLimit: 5000000, // Higher gas limit for this complex operation
          maxFeePerGas: feeData.maxFeePerGas || ethers.utils.parseUnits("50", "gwei"),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.utils.parseUnits("40", "gwei")
        }
      );
      
      logger.info(`Poll creation with funding transaction submitted: ${tx.hash}`);
      
      // Wait for the transaction to be mined with more patience (needs more confirmations)
      const receipt = await tx.wait(2); // Wait for 2 confirmations
      
      // Extract the poll address from the event
      let pollAddress = null;
      const event = receipt.events?.find(e => e.event === 'PollCreatedAndFunded');
      if (event && event.args) {
        pollAddress = event.args.pollAddress;
      } else {
        // Fallback: Look for regular PollCreated event
        const simpleEvent = receipt.events?.find(e => e.event === 'PollCreated');
        if (simpleEvent && simpleEvent.args) {
          pollAddress = simpleEvent.args.pollAddress;
        } else {
          // Last resort: Try to parse from logs
          const logs = receipt.logs || [];
          for (const log of logs) {
            try {
              const parsed = signedFactory.interface.parseLog(log);
              if (parsed.name === 'PollCreatedAndFunded' || parsed.name === 'PollCreated') {
                pollAddress = parsed.args.pollAddress;
                break;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
      
      if (!pollAddress) {
        throw new Error('Failed to extract poll address from transaction receipt');
      }
      
      logger.info(`Poll created and funded at ${pollAddress}`);
      
      return {
        transactionHash: receipt.transactionHash,
        pollAddress
      };
    } catch (error) {
      logger.error('Error creating poll with funding:', error);
      throw error;
    }
  }
  
  /**
   * Approve USDT spending for a smart wallet
   * @param {string} ownerAddress - Address of the USDT owner
   * @param {string} spenderAddress - Address allowed to spend the USDT (usually the factory)
   * @param {string|number} amount - Amount to approve in USDT
   * @returns {Promise<Object>} Transaction result
   */
  async approveUSDT(ownerAddress, spenderAddress, amount) {
    try {
      logger.info(`Approving ${amount} USDT from ${ownerAddress} to ${spenderAddress}`);
      
      // Format the amount with 6 decimals (USDT standard)
      const amountWei = ethers.utils.parseUnits(amount.toString(), 6);
      
      // Get USDT contract
      const usdtContract = new ethers.Contract(
        this.usdtAddress,
        [
          "function approve(address spender, uint256 amount) returns (bool)",
          "function allowance(address owner, address spender) view returns (uint256)"
        ],
        this.provider
      );
      
      // Check current allowance
      const currentAllowance = await usdtContract.allowance(ownerAddress, spenderAddress);
      if (currentAllowance.gte(amountWei)) {
        logger.info(`Allowance of ${ethers.utils.formatUnits(currentAllowance, 6)} USDT already approved`);
        return {
          success: true,
          transactionHash: null, // No transaction needed
          allowance: ethers.utils.formatUnits(currentAllowance, 6)
        };
      }
      
      // Get signed contract for approval
      const signedUSDT = await this.platformWalletProvider.getSignedContract(
        this.usdtAddress,
        [
          "function approve(address spender, uint256 amount) returns (bool)"
        ],
        'approve_usdt'
      );
      
      // Execute the approval transaction
      const tx = await signedUSDT.approve(
        spenderAddress,
        amountWei,
        {
          gasLimit: 100000, // Standard gas limit for ERC20 approve
          maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
          maxPriorityFeePerGas: ethers.utils.parseUnits("40", "gwei")
        }
      );
      
      logger.info(`USDT approval transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        allowance: ethers.utils.formatUnits(amountWei, 6)
      };
    } catch (error) {
      logger.error("Error approving USDT:", error);
      throw error;
    }
  }
  
  // Fund poll with rewards
  async fundPollRewards(pollAddress, amount) {
    try {
      logger.info(`Funding poll ${pollAddress} with ${amount} USDT`);
      
      // Parse amount to USDT decimals (6)
      const amountWei = ethers.utils.parseUnits(amount.toString(), 6);
      
      // Get signed contract
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'fund_rewards'
      );
      
      // Fund rewards
      const tx = await signedPoll.fundRewards(amountWei, this.gasSettings);
      logger.info(`Fund rewards transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Poll funded successfully: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error('Error funding poll rewards:', error);
      throw error;
    }
  }
  
  // Get USDT balance for an address
  async getUSDTBalance(address) {
    try {
      if (!this.usdtAddress) {
        throw new Error('USDT address not configured');
      }
      
      const usdtContract = new ethers.Contract(
        this.usdtAddress,
        [
          "function balanceOf(address owner) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ],
        this.provider
      );
      
      // Get token decimals
      const decimals = await usdtContract.decimals();
      
      // Get balance
      const balanceWei = await usdtContract.balanceOf(address);
      const balance = ethers.utils.formatUnits(balanceWei, decimals);
      
      logger.info(`USDT balance for ${address}: ${balance}`);
      
      return balance;
    } catch (error) {
      logger.error(`Error getting USDT balance for ${address}:`, error);
      throw error;
    }
  }
  
  // Get poll details
  async getPollDetails(pollAddress) {
    try {
      logger.info(`Getting details for poll ${pollAddress}`);
      
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      // Get basic poll info
      const title = await pollContract.title();
      const options = await pollContract.getOptions();
      const isActive = await pollContract.isPollActive();
      const results = await pollContract.getResults();
      const totalVotes = await pollContract.totalVotes();
      const creationTime = await pollContract.creationTime();
      const endTime = await pollContract.endTime();
      const owner = await pollContract.owner();
      
      // Get reward info if USDT is available
      let rewardPerVoter = ethers.BigNumber.from(0);
      let totalRewards = ethers.BigNumber.from(0);
      
      try {
        rewardPerVoter = await pollContract.rewardPerVoter();
        totalRewards = await pollContract.totalRewards();
      } catch (err) {
        logger.warn(`This poll doesn't support rewards`, err.message);
      }
      
      // Format results
      const pollDetails = {
        title,
        options,
        isActive,
        results: results.map(r => r.toNumber()),
        totalVotes: totalVotes.toNumber(),
        creationTime: new Date(creationTime.toNumber() * 1000),
        endTime: endTime.toNumber() > 0 ? new Date(endTime.toNumber() * 1000) : null,
        owner,
        hasRewards: !rewardPerVoter.isZero(),
        rewardPerVoter: ethers.utils.formatUnits(rewardPerVoter, 6),
        totalRewards: ethers.utils.formatUnits(totalRewards, 6)
      };
      
      logger.info(`Poll details retrieved for ${pollAddress}`);
      
      return pollDetails;
    } catch (error) {
      logger.error(`Error getting poll details for ${pollAddress}:`, error);
      throw error;
    }
  }
  
  // Check if user has voted
  async hasUserVoted(pollAddress, userAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      return await pollContract.hasVoted(userAddress);
    } catch (error) {
      logger.error(`Error checking if user ${userAddress} voted on poll ${pollAddress}:`, error);
      throw error;
    }
  }
  
  // Get user vote
  async getUserVote(pollAddress, userAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      // Check if user has voted first
      const hasVoted = await pollContract.hasVoted(userAddress);
      
      if (!hasVoted) {
        return -1; // User hasn't voted
      }
      
      return await pollContract.getUserVote(userAddress);
    } catch (error) {
      logger.error(`Error getting user vote for ${userAddress} on poll ${pollAddress}:`, error);
      // Return -1 if there's an error (user hasn't voted)
      return -1;
    }
  }
  
  // Get all polls
  async getAllPolls() {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      const pollAddresses = await this.factoryContract.getDeployedPolls();
      logger.info(`Retrieved ${pollAddresses.length} polls`);
      
      return pollAddresses;
    } catch (error) {
      logger.error('Error getting all polls:', error);
      throw error;
    }
  }
  
  // Get polls by creator
  async getPollsByCreator(creatorAddress) {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      const pollAddresses = await this.factoryContract.getPollsByCreator(creatorAddress);
      logger.info(`Retrieved ${pollAddresses.length} polls created by ${creatorAddress}`);
      
      return pollAddresses;
    } catch (error) {
      logger.error(`Error getting polls for creator ${creatorAddress}:`, error);
      throw error;
    }
  }
  
  // Check if user has received reward
  async hasUserReceivedReward(pollAddress, userAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      // Call hasVotedAndRewarded method on the updated contract
      return await pollContract.hasVotedAndRewarded(userAddress);
    } catch (error) {
      logger.error(`Error checking if user ${userAddress} has received rewards for poll ${pollAddress}:`, error);
      return false;
    }
  }
  
  // Get current nonce for a user
  async getUserNonce(pollAddress, userAddress) {
    try {
      const pollContract = new ethers.Contract(
        pollAddress,
        Poll.abi,
        this.provider
      );
      
      const nonce = await pollContract.getNonce(userAddress);
      return nonce.toNumber();
    } catch (error) {
      logger.error(`Error getting nonce for user ${userAddress} on poll ${pollAddress}:`, error);
      throw error;
    }
  }

  // End poll (needs signing)
  async endPoll(pollAddress) {
    try {
      logger.info(`Ending poll at ${pollAddress}`);
      
      // Get signed contract
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'end_poll'
      );
      
      // Call the endPoll function
      const tx = await signedPoll.endPoll(this.gasSettings);
      logger.info(`End poll transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Poll ended successfully: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error(`Error ending poll ${pollAddress}:`, error);
      throw error;
    }
  }

  // Reactivate poll (needs signing)
  async reactivatePoll(pollAddress, duration = 0) {
    try {
      logger.info(`Reactivating poll at ${pollAddress} with duration ${duration}`);
      
      // Get signed contract
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'reactivate_poll'
      );
      
      // Call the reactivatePoll function
      const tx = await signedPoll.reactivatePoll(duration, this.gasSettings);
      logger.info(`Reactivate poll transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Poll reactivated successfully: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error(`Error reactivating poll ${pollAddress}:`, error);
      throw error;
    }
  }

  // Withdraw remaining rewards (needs signing)
  async withdrawRemainingRewards(pollAddress) {
    try {
      logger.info(`Withdrawing remaining rewards from poll ${pollAddress}`);
      
      // Get signed contract
      const signedPoll = await this.platformWalletProvider.getSignedContract(
        pollAddress,
        Poll.abi,
        'withdraw_rewards'
      );
      
      // Call the withdrawRemainingRewards function
      const tx = await signedPoll.withdrawRemainingRewards(this.gasSettings);
      logger.info(`Withdraw rewards transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Rewards withdrawn successfully: ${receipt.transactionHash}`);
      
      return {
        transactionHash: receipt.transactionHash,
        success: true
      };
    } catch (error) {
      logger.error(`Error withdrawing rewards from poll ${pollAddress}:`, error);
      throw error;
    }
  }
  
  // Get platform fee percentage
  async getPlatformFeePercent() {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      const feePercent = await this.factoryContract.platformFeePercent();
      // Convert from basis points (e.g. 600 = 6.00%)
      return feePercent.toNumber() / 100;
    } catch (error) {
      logger.error('Error getting platform fee percent:', error);
      return 6; // Default fee percentage
    }
  }
  
  // Calculate platform fee
  async calculatePlatformFee(amount) {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }
      
      const amountWei = ethers.utils.parseUnits(amount.toString(), 6);
      const feeWei = await this.factoryContract.calculatePlatformFee(amountWei);
      
      return ethers.utils.formatUnits(feeWei, 6);
    } catch (error) {
      logger.error('Error calculating platform fee:', error);
      // Fallback calculation (6%)
      return (parseFloat(amount) * 0.06).toFixed(6);
    }
  }
  
  // Deploy factory contract - admin function
  async deployFactory() {
    try {
      logger.info('Deploying new PollFactory contract');
      
      // Get signer
      const signer = await this.platformWalletProvider.getSigner('deploy_factory');
      
      // Get the factory contract factory
      const Factory = new ethers.ContractFactory(
        PollFactory.abi,
        PollFactory.bytecode,
        signer
      );
      
      // Deploy the contract
      const factory = await Factory.deploy(
        this.usdtAddress,
        this.gasSettings
      );
      
      logger.info(`Factory deployment transaction submitted: ${factory.deployTransaction.hash}`);
      
      // Wait for deployment
      await factory.deployed();
      
      logger.info(`Factory deployed at: ${factory.address}`);
      
      return factory.address;
    } catch (error) {
      logger.error('Error deploying factory:', error);
      throw error;
    }
  }
}

module.exports = ContractService;