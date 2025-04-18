// src/utils/web3Helper.js
import { ethers } from 'ethers';
import api from './api';
import logger from './logger';

// ABI fragments for essential functions
const ERC20_ABI_FRAGMENT = [
  // Read functions
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  // Write functions
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

// Poll Factory ABI fragment for createAndFundPoll
const POLL_FACTORY_ABI_FRAGMENT = [
  'function createAndFundPoll(string memory _title, string[] memory _options, uint256 _duration, uint256 _rewardPerVoter, uint256 _fundAmount) external returns (address)'
];

/**
 * Sign a transaction for meta-transaction execution through smart wallet
 * @param {object} provider - Web3 provider (ethers)
 * @param {string} targetAddress - Contract address to call
 * @param {string} callData - Encoded function call data
 * @param {string} value - ETH value to send (default '0')
 * @returns {Promise<object>} Signed transaction details
 */
export async function signTransaction(provider, targetAddress, callData, value = '0') {
  try {
    logger.debug('Signing transaction for target:', targetAddress);
    
    // Get signer from provider
    const signer = provider.getSigner();
    const signerAddress = await signer.getAddress();
    
    // Create message hash - using keccak256 of packed types
    const messageHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ['address', 'uint256', 'bytes32'],
        [targetAddress, ethers.BigNumber.from(value), ethers.utils.keccak256(callData)]
      )
    );
    
    // Sign the hash (EIP-191 prefixed message)
    const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
    logger.debug('Transaction signature created successfully');
    
    return {
      targetAddress,
      callData,
      value,
      signature,
      signerAddress
    };
  } catch (error) {
    logger.error('Error signing transaction:', error);
    throw error;
  }
}

/**
 * Sign USDT approval for spending by another address (usually the poll factory)
 * @param {object} provider - Web3 provider (ethers)
 * @param {string} tokenAddress - USDT token address
 * @param {string} spenderAddress - Address authorized to spend tokens (factory)
 * @param {string|number} amount - Amount to approve (as string or number)
 * @returns {Promise<object>} Approval transaction details
 */
export async function signTokenApproval(provider, tokenAddress, spenderAddress, amount) {
  try {
    logger.debug(`Signing token approval: ${amount} tokens for spender ${spenderAddress}`);
    
    // Create token contract instance
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI_FRAGMENT,
      provider
    );
    
    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Parse amount with proper decimals
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), decimals);
    
    // Encode the approval function call
    const approveData = tokenContract.interface.encodeFunctionData(
      'approve',
      [spenderAddress, parsedAmount]
    );
    
    // Sign the transaction using the standard signTransaction function
    return await signTransaction(provider, tokenAddress, approveData);
  } catch (error) {
    logger.error('Error signing token approval:', error);
    throw error;
  }
}

/**
 * Create and sign a Poll creation transaction with funding
 * @param {object} provider - Web3 provider (ethers)
 * @param {string} factoryAddress - PollFactory contract address
 * @param {object} pollData - Poll creation data
 * @returns {Promise<object>} Signed transaction details
 */
export async function signCreatePollWithFunding(provider, factoryAddress, pollData) {
  try {
    logger.debug('Preparing create poll with funding transaction');
    
    const { title, options, duration, rewardPerVoter, totalFundAmount } = pollData;
    
    // Create factory contract instance
    const factoryContract = new ethers.Contract(
      factoryAddress,
      POLL_FACTORY_ABI_FRAGMENT,
      provider
    );
    
    // Convert reward to USDT decimals (6)
    const rewardAmount = ethers.utils.parseUnits(rewardPerVoter.toString(), 6);
    
    // Convert total fund amount to USDT decimals (6)
    const fundAmount = ethers.utils.parseUnits(totalFundAmount.toString(), 6);
    
    // Encode the createAndFundPoll function call
    const createPollData = factoryContract.interface.encodeFunctionData(
      'createAndFundPoll',
      [title, options, Number(duration), rewardAmount, fundAmount]
    );
    
    // Sign the transaction
    return await signTransaction(provider, factoryAddress, createPollData);
  } catch (error) {
    logger.error('Error signing create poll transaction:', error);
    throw error;
  }
}

/**
 * Check USDT balance for an address
 * @param {object} provider - Web3 provider (ethers)
 * @param {string} tokenAddress - USDT token address
 * @param {string} accountAddress - Address to check balance for
 * @returns {Promise<string>} Formatted balance as string
 */
export async function checkUSDTBalance(provider, tokenAddress, accountAddress) {
  try {
    logger.debug(`Checking USDT balance for ${accountAddress}`);
    
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI_FRAGMENT,
      provider
    );
    
    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Get balance
    const balance = await tokenContract.balanceOf(accountAddress);
    
    // Format with proper decimals
    return ethers.utils.formatUnits(balance, decimals);
  } catch (error) {
    logger.error('Error checking USDT balance:', error);
    throw error;
  }
}

/**
 * Check allowance for a spender to spend tokens on behalf of owner
 * @param {object} provider - Web3 provider (ethers)
 * @param {string} tokenAddress - USDT token address
 * @param {string} ownerAddress - Token owner address
 * @param {string} spenderAddress - Token spender address
 * @returns {Promise<string>} Formatted allowance as string
 */
export async function checkUSDTAllowance(provider, tokenAddress, ownerAddress, spenderAddress) {
  try {
    logger.debug(`Checking allowance for ${spenderAddress} to spend tokens of ${ownerAddress}`);
    
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI_FRAGMENT,
      provider
    );
    
    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Get allowance
    const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
    
    // Format with proper decimals
    return ethers.utils.formatUnits(allowance, decimals);
  } catch (error) {
    logger.error('Error checking USDT allowance:', error);
    throw error;
  }
}

/**
 * Calculate platform fee based on fund amount
 * @param {string|number} fundAmount - Amount to fund (as string or number)
 * @param {number} feePercentage - Platform fee percentage (e.g., 6 for 6%)
 * @returns {string} Calculated fee as string (formatted with 2 decimal places)
 */
export function calculatePlatformFee(fundAmount, feePercentage = 6) {
  try {
    const amount = parseFloat(fundAmount);
    if (isNaN(amount)) return '0.00';
    
    const fee = (amount * feePercentage) / 100;
    return fee.toFixed(2);
  } catch (error) {
    logger.error('Error calculating platform fee:', error);
    return '0.00';
  }
}

/**
 * Calculate total cost including fund amount and platform fee
 * @param {string|number} fundAmount - Amount to fund (as string or number)
 * @param {number} feePercentage - Platform fee percentage (e.g., 6 for 6%)
 * @returns {string} Total cost as string (formatted with 2 decimal places)
 */
export function calculateTotalCost(fundAmount, feePercentage = 6) {
  try {
    const amount = parseFloat(fundAmount);
    if (isNaN(amount)) return '0.00';
    
    const fee = (amount * feePercentage) / 100;
    const total = amount + fee;
    return total.toFixed(2);
  } catch (error) {
    logger.error('Error calculating total cost:', error);
    return '0.00';
  }
}

/**
 * Request deployment of a smart wallet with signature proof of address ownership
 * @param {string} userAddress - User's Ethereum address
 * @param {object} provider - Ethereum provider (e.g., window.ethereum)
 * @returns {Promise<object>} Response with wallet address and deployment status
 */
export async function requestWalletDeployment(userAddress, provider) {
  try {
    // Check authentication status first
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const authToken = localStorage.getItem('authToken');
    
    if (!isAuthenticated || !authToken) {
      throw new Error("Authentication required. Please connect your wallet or sign in first.");
    }
    
    // Normalize address
    const normalizedAddress = userAddress.toLowerCase();
    let signature = null;
    
    if (provider) {
      try {
        // Create the message (must match backend exactly)
        const message = `I authorize the deployment of a smart wallet for ${normalizedAddress} on TruthPoll`;
        
        // Create Web3 provider and signer
        const web3Provider = new ethers.providers.Web3Provider(provider);
        const signer = web3Provider.getSigner();
        
        // Get the signature
        signature = await signer.signMessage(message);
        logger.debug("Wallet deployment signature obtained");
      } catch (signError) {
        logger.error("Error getting signature:", signError);
        throw new Error("Failed to sign wallet deployment message. Please try again.");
      }
    }
    
    // Send request to backend
    const response = await api.post('/smart-wallets', {
      userAddress: normalizedAddress,
      signature
    });
    
    return response.data;
  } catch (error) {
    logger.error("Failed to deploy smart wallet:", error);
    throw error;
  }
}

/**
 * Sign a vote for a poll (with gas provided by relayer)
 * @param {object} provider - Web3 provider (ethers)
 * @param {string} pollAddress - Poll contract address
 * @param {number} optionIndex - Option index to vote for
 * @param {number} nonce - Current nonce for this voter
 * @returns {Promise<string>} Signature for the vote
 */
export async function signVote(provider, pollAddress, optionIndex, nonce) {
  try {
    logger.debug(`Signing vote for poll ${pollAddress}, option ${optionIndex}, nonce ${nonce}`);
    
    // Get signer
    const signer = provider.getSigner();
    const signerAddress = await signer.getAddress();
    
    // Create domain data for EIP-712
    const domain = {
      name: 'TruthPoll',
      version: '1',
      chainId: 80002, // Polygon Amoy testnet
      verifyingContract: pollAddress
    };
    
    // Define types for EIP-712
    const types = {
      Vote: [
        { name: 'voter', type: 'address' },
        { name: 'option', type: 'uint256' },
        { name: 'nonce', type: 'uint256' }
      ]
    };
    
    // Create value object
    const value = {
      voter: signerAddress,
      option: optionIndex,
      nonce: nonce
    };
    
    // Sign with EIP-712
    const signature = await signer._signTypedData(domain, types, value);
    logger.debug("Vote signature created successfully");
    
    return signature;
  } catch (error) {
    logger.error('Error signing vote:', error);
    throw error;
  }
}

// Format address for display
export function formatAddress(address) {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Format USDT amount (6 decimals)
export function formatUSDT(amount) {
  if (amount === undefined || amount === null) return '0.00';
  try {
    if (typeof amount === 'string' && amount.includes('e')) {
      // Handle scientific notation
      const num = parseFloat(amount);
      return num.toFixed(2);
    }
    return parseFloat(amount).toFixed(2);
  } catch (e) {
    logger.error("Error formatting USDT amount:", e);
    return '0.00';
  }
}

