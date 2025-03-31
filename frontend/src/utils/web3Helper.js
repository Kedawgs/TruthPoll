// src/utils/web3Helper.js
import { ethers } from 'ethers';
import api from './api';

// Sign a transaction for meta-transaction execution
export async function signTransaction(provider, targetAddress, callData, value = '0') {
  try {
    // Get signer from provider
    const signer = provider.getSigner();
    const signerAddress = await signer.getAddress();
    
    // Create message hash
    const messageHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'bytes32'],
        [targetAddress, ethers.BigNumber.from(value), ethers.utils.keccak256(callData)]
      )
    );
    
    // Sign the hash (EIP-191 prefixed message)
    const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
    
    return {
      targetAddress,
      callData,
      value,
      signature,
      signerAddress
    };
  } catch (error) {
    console.error('Error signing transaction:', error);
    throw error;
  }
}

// Sign a token approval for meta-transaction
export async function signTokenApproval(provider, tokenAddress, spenderAddress, amount) {
  try {
    // Get signer from provider
    const signer = provider.getSigner();
    const signerAddress = await signer.getAddress();
    
    // Create message hash for the approval
    const messageHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'address', 'uint256', 'string'],
        [tokenAddress, spenderAddress, amount, 'approve']
      )
    );
    
    // Sign the hash (EIP-191 prefixed message)
    const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
    
    return {
      tokenAddress,
      spenderAddress,
      amount,
      signature,
      signerAddress
    };
  } catch (error) {
    console.error('Error signing token approval:', error);
    throw error;
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
    // Normalize address
    const normalizedAddress = userAddress.toLowerCase();
    
    // For web3 wallet users, get a signature
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
        console.log("Wallet deployment signature obtained");
      } catch (signError) {
        console.error("Error getting signature:", signError);
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
    console.error("Failed to deploy smart wallet:", error);
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
  if (!amount) return '0';
  return ethers.utils.formatUnits(amount, 6);
}

// Parse USDT amount (6 decimals)
export function parseUSDT(amount) {
  if (!amount) return ethers.BigNumber.from(0);
  return ethers.utils.parseUnits(amount.toString(), 6);
}