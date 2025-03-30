// src/context/ContractContext.js

import React, { createContext, useState, useContext, useCallback } from 'react';
import { ethers } from 'ethers';
import { AuthContext } from './AuthContext';
import { WalletContext } from './WalletContext';
import api from '../utils/api';
import logger from '../utils/logger';

// Create context
export const ContractContext = createContext();

export const ContractProvider = ({ children }) => {
  const { isConnected, account, authType, provider, signer } = useContext(AuthContext);
  const { smartWalletAddress, deploySmartWalletIfNeeded, signSmartWalletTransaction } = useContext(WalletContext);
  
  const [pollLoading, setPollLoading] = useState(false);
  const [pollError, setPollError] = useState(null);
  
  // Reset error when auth state changes
  React.useEffect(() => {
    setPollError(null);
  }, [isConnected, account]);
  
  // Create poll
  const createPoll = async (pollData) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      setPollLoading(true);
      setPollError(null);
      
      // For wallet users (non-Magic), make sure smart wallet is deployed
      if (authType === 'wallet') {
        try {
          await deploySmartWalletIfNeeded();
        } catch (walletError) {
          logger.error("Error deploying smart wallet:", walletError);
          // Continue anyway, the backend will handle deployment if needed
        }
      }
      
      // Create poll
      const response = await api.post('/polls', {
        ...pollData,
        creator: account
      });
      
      setPollLoading(false);
      
      return response.data;
    } catch (error) {
      logger.error("Error creating poll:", error);
      setPollError(error.response?.data?.error || error.message || 'Failed to create poll');
      setPollLoading(false);
      throw error;
    }
  };
  
  // Vote on a poll - unified for both Magic and wallet users
  const votePoll = async (id, optionIndex) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      setPollLoading(true);
      setPollError(null);
      
      // Add these checks
      if (!account) {
        throw new Error('No account available. Please reconnect your wallet.');
      }
      
      if (!signer) {
        throw new Error('Provider not initialized');
      }
  
      // Get poll contract address
      const pollResponse = await getPoll(id);
      const pollAddress = pollResponse.data.contractAddress;
      
      // Add explicit logging
      logger.info("Preparing to sign vote with:", {
        id,
        optionIndex,
        pollAddress,
        account,
        authType
      });
  
      // Sign the vote
      let signature;
      
      if (authType === 'magic') {
        // For Magic users - sign with Magic wallet
        signature = await signMagicVote(pollAddress, optionIndex);
      } else {
        // For wallet users - sign with their wallet
        // First get the calldata for the vote function
        const pollInterface = new ethers.utils.Interface([
          'function vote(uint256 _option) external'
        ]);
        
        // Encode the vote function call
        const callData = pollInterface.encodeFunctionData('vote', [optionIndex]);
        
        // Sign the transaction
        signature = await signSmartWalletTransaction(pollAddress, callData);
      }
      
      // Send to backend for relaying
      const response = await api.post(`/polls/${id}/vote`, {
        optionIndex,
        voterAddress: account,
        signature
      });
      
      setPollLoading(false);
      return response.data;
    } catch (error) {
      logger.error("Error voting on poll:", error);
      setPollError(error.response?.data?.error || error.message || 'Failed to vote on poll');
      setPollLoading(false);
      throw error;
    }
  };
  
  // Sign a vote with Magic
  const signMagicVote = async (pollAddress, optionIndex) => {
    try {
      logger.debug("====== DEBUG SIGN MAGIC VOTE ======");
      logger.debug("Parameters:", { pollAddress, optionIndex, account });
  
      // Get user's nonce
      const nonceResponse = await api.get(`/polls/nonce/${pollAddress}/${account}`);
      const nonce = nonceResponse.data.data.nonce;
      logger.debug("Fetched nonce:", nonce);
      
      // Create domain data - IMPORTANT: Must match the contract exactly
      const domain = {
        name: 'TruthPoll',
        version: '1',
        chainId: 80002,
        verifyingContract: pollAddress
      };
      
      logger.debug("Domain data:", domain);
  
      // Define types - IMPORTANT: must match the contract exactly
      const types = {
        Vote: [
          { name: 'voter', type: 'address' },
          { name: 'option', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }
        ]
      };
      
      // Create value - Make sure to use correct types
      const value = {
        voter: account,
        option: optionIndex,
        nonce: nonce
      };
      
      logger.debug("Value to sign:", value);
      
      // Sign typed data
      const magicSigner = provider.getSigner();
      logger.debug("Getting signer address...");
      const signerAddress = await magicSigner.getAddress();
      logger.debug("Signer address:", signerAddress);
      
      logger.debug("Signing typed data...");
      const signature = await magicSigner._signTypedData(domain, types, value);
      logger.debug("Signature generated:", signature);
      
      return signature;
    } catch (error) {
      logger.error("Error signing with Magic:", error);
      logger.error("Error details:", {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  };
  
  // Claim rewards - UPDATED to handle Magic users differently
  const claimReward = async (pollAddress) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      setPollLoading(true);
      setPollError(null);
      
      // Sign the claim
      let signature;
      
      if (authType === 'magic') {
        // For Magic users - sign directly
        signature = await signMagicRewardClaim(pollAddress);
      } else {
        // For wallet users - sign through smart wallet
        // Create a message hash for the smart wallet to execute
        const pollInterface = new ethers.utils.Interface([
          'function claimReward() external'
        ]);
        
        // Encode the claimReward function call
        const callData = pollInterface.encodeFunctionData('claimReward', []);
        
        // Sign the transaction
        signature = await signSmartWalletTransaction(pollAddress, callData);
      }
      
      // Send to backend for relaying
      const response = await api.post(`/polls/claim-reward`, {
        pollAddress,
        signature
      });
      
      setPollLoading(false);
      return response.data;
    } catch (error) {
      logger.error("Error claiming reward:", error);
      setPollError(error.response?.data?.error || error.message || 'Failed to claim reward');
      setPollLoading(false);
      throw error;
    }
  };
  
  // Sign a reward claim with Magic
  const signMagicRewardClaim = async (pollAddress) => {
    try {
      // Get user's nonce
      const nonceResponse = await api.get(`/polls/nonce/${pollAddress}/${account}`);
      const nonce = nonceResponse.data.data.nonce;
      
      // Create domain data
      const domain = {
        name: 'TruthPoll',
        version: '1',
        chainId: 80002, // Polygon Amoy
        verifyingContract: pollAddress
      };
      
      // Define types
      const types = {
        ClaimReward: [
          { name: 'claimer', type: 'address' },
          { name: 'nonce', type: 'uint256' }
        ]
      };
      
      // Create value
      const value = {
        claimer: account,
        nonce: nonce
      };
      
      // Sign typed data
      const magicSigner = provider.getSigner();
      const signature = await magicSigner._signTypedData(domain, types, value);
      
      return signature;
    } catch (error) {
      logger.error("Error signing reward claim with Magic:", error);
      throw error;
    }
  };
  
  // Get polls
  const getPolls = useCallback(async (params = {}) => {
    try {
      const response = await api.get('/polls', { params });
      return response.data;
    } catch (error) {
      logger.error("Error fetching polls:", error);
      throw error;
    }
  }, []);

  // Get single poll
  const getPoll = useCallback(async (id) => {
    try {
      const response = await api.get(`/polls/${id}`);
      return response.data;
    } catch (error) {
      logger.error("Error fetching poll:", error);
      throw error;
    }
  }, []);

  // Get claimable rewards
  const getClaimableRewards = useCallback(async () => {
    try {
      if (!isConnected || !account) {
        return { data: [] };
      }
      
      const response = await api.get(`/polls/claimable-rewards/${account}`);
      return response.data;
    } catch (error) {
      logger.error("Error fetching claimable rewards:", error);
      return { data: [] };
    }
  }, [isConnected, account]);

  // End poll (only for poll creator)
  const endPoll = async (pollId) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      setPollLoading(true);
      setPollError(null);
      
      // Get poll details first to verify ownership
      const pollData = await getPoll(pollId);
      
      // Check if the user is the poll creator
      if (pollData.data.creator.toLowerCase() !== account.toLowerCase()) {
        throw new Error('Only the poll creator can end a poll');
      }
      
      // End the poll
      const response = await api.put(`/polls/${pollId}/end`);
      
      setPollLoading(false);
      return response.data;
    } catch (error) {
      logger.error("Error ending poll:", error);
      setPollError(error.response?.data?.error || error.message || 'Failed to end poll');
      setPollLoading(false);
      throw error;
    }
  };

  // Reactivate poll (only for poll creator)
  const reactivatePoll = async (pollId, duration = 0) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      setPollLoading(true);
      setPollError(null);
      
      // Get poll details first to verify ownership
      const pollData = await getPoll(pollId);
      
      // Check if the user is the poll creator
      if (pollData.data.creator.toLowerCase() !== account.toLowerCase()) {
        throw new Error('Only the poll creator can reactivate a poll');
      }
      
      // Reactivate the poll
      const response = await api.put(`/polls/${pollId}/reactivate`, { duration });
      
      setPollLoading(false);
      return response.data;
    } catch (error) {
      logger.error("Error reactivating poll:", error);
      setPollError(error.response?.data?.error || error.message || 'Failed to reactivate poll');
      setPollLoading(false);
      throw error;
    }
  };

  return (
    <ContractContext.Provider
      value={{
        pollLoading,
        pollError,
        createPoll,
        votePoll,
        claimReward,
        getPolls,
        getPoll,
        getClaimableRewards,
        endPoll,
        reactivatePoll
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};