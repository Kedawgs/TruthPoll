// src/context/Web3Context.js

// Import necessary libraries
import React, { createContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import createMagicInstance from '../config/magic';
import api from '../utils/api';

// Create context
export const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
  // State variables
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [smartWalletAddress, setSmartWalletAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [magic, setMagic] = useState(null);
  const [authType, setAuthType] = useState(null); // 'magic' or 'wallet'
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Open/close auth modal
  const openAuthModal = () => setShowAuthModal(true);
  const closeAuthModal = () => setShowAuthModal(false);
  
  // Initialize on mount
  useEffect(() => {
    checkExistingAuth();
  }, []);
  
  // Check if user is already authenticated
  const checkExistingAuth = async () => {
    try {
      console.log("Checking for existing authentication...");
      
      // First check for Magic session
      const magicInstance = createMagicInstance();
      if (magicInstance) {
        setMagic(magicInstance);
        const isLoggedIn = await magicInstance.user.isLoggedIn();
        
        if (isLoggedIn) {
          console.log("User is logged in with Magic");
          await initMagicUser(magicInstance);
          return;
        }
      }
      
      // If no Magic session, check for connected wallet
      if (window.ethereum) {
        await initWalletConnection();
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error checking authentication:", error);
      setLoading(false);
    }
  };
  
  // Initialize Magic user
  const initMagicUser = async (magicInstance) => {
    try {
      const magicProvider = new ethers.providers.Web3Provider(magicInstance.rpcProvider);
      const userMetadata = await magicInstance.user.getInfo();
      
      setProvider(magicProvider);
      setAccount(userMetadata.publicAddress);
      setSigner(magicProvider.getSigner());
      setIsConnected(true);
      setAuthType('magic');
      
      try {
        const network = await magicProvider.getNetwork();
        setChainId(network.chainId);
      } catch (err) {
        console.error("Error getting network:", err);
      }
      
      setLoading(false);
      
      console.log("Magic user initialized:", userMetadata.publicAddress);
    } catch (error) {
      console.error("Error initializing Magic user:", error);
      setLoading(false);
    }
  };
  
  // Initialize wallet connection
  const initWalletConnection = async () => {
    try {
      if (!window.ethereum) {
        console.log("No ethereum provider found");
        setLoading(false);
        return;
      }
      
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(web3Provider);
      
      // Get network
      const network = await web3Provider.getNetwork();
      setChainId(network.chainId);
      
      // Check if already connected
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length > 0) {
        console.log("Wallet already connected:", accounts[0]);
        setAccount(accounts[0]);
        setSigner(web3Provider.getSigner());
        setIsConnected(true);
        setAuthType('wallet');
        
        // Get smart wallet address
        await getSmartWalletAddress(accounts[0]);
      }
      
      // Set up listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      setLoading(false);
    } catch (error) {
      console.error("Error initializing wallet connection:", error);
      setLoading(false);
    }
  };
  
  // Get smart wallet address for non-Magic users
  const getSmartWalletAddress = async (userAddress) => {
    try {
      const response = await api.get(`/smart-wallets/${userAddress}`);
      
      if (response.data.success) {
        setSmartWalletAddress(response.data.data.address);
        console.log("Smart wallet address:", response.data.data.address);
      }
    } catch (error) {
      console.error("Error getting smart wallet address:", error);
    }
  };
  
  // Handle accounts changed event
  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      // User disconnected
      setAccount(null);
      setSigner(null);
      setIsConnected(false);
      setSmartWalletAddress(null);
      setAuthType(null);
    } else {
      // Account changed
      setAccount(accounts[0]);
      if (provider) {
        setSigner(provider.getSigner());
        await getSmartWalletAddress(accounts[0]);
      }
    }
  };
  
  // Handle chain changed event
  const handleChainChanged = () => {
    window.location.reload();
  };
  
  // Connect wallet
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setError('MetaMask is not installed. Please install it to use this app.');
        return false;
      }
      
      setLoading(true);
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length > 0) {
        // Create provider if not exists
        if (!provider) {
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(web3Provider);
          setSigner(web3Provider.getSigner());
          
          // Get network
          const network = await web3Provider.getNetwork();
          setChainId(network.chainId);
        } else {
          setSigner(provider.getSigner());
        }
        
        setAccount(accounts[0]);
        setIsConnected(true);
        setAuthType('wallet');
        
        // Get smart wallet address
        await getSmartWalletAddress(accounts[0]);
        
        setLoading(false);
        return true;
      }
      
      setLoading(false);
      return false;
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError('Failed to connect wallet');
      setLoading(false);
      return false;
    }
  };
  
  // Login with Magic
  const loginWithMagic = async (method, params) => {
    try {
      setLoading(true);
      
      const magicInstance = createMagicInstance();
      setMagic(magicInstance);
      
      if (!magicInstance) {
        throw new Error('Magic not initialized');
      }
      
      if (method === 'email') {
        await magicInstance.auth.loginWithMagicLink({ email: params.email });
        await initMagicUser(magicInstance);
        return true;
      } else if (method === 'google') {
        await magicInstance.oauth.loginWithRedirect({
          provider: 'google',
          redirectURI: `${window.location.origin}/magic-callback`
        });
        // This will redirect
        return false;
      } else {
        throw new Error('Unsupported login method');
      }
    } catch (error) {
      console.error("Error logging in with Magic:", error);
      setError(error.message || 'Failed to login');
      setLoading(false);
      return false;
    }
  };
  
  // Logout
  const logout = async () => {
    try {
      if (authType === 'magic' && magic) {
        await magic.user.logout();
      }
      
      // Reset state
      setAccount(null);
      setSigner(null);
      setIsConnected(false);
      setSmartWalletAddress(null);
      setAuthType(null);
      
      return true;
    } catch (error) {
      console.error("Error logging out:", error);
      return false;
    }
  };
  
  // Vote on a poll - unified for both Magic and wallet users
  const votePoll = async (id, optionIndex) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      // Get poll contract address
      const pollResponse = await getPoll(id);
      const pollAddress = pollResponse.data.contractAddress;
      
      // Sign the vote
      let signature;
      
      if (authType === 'magic') {
        // For Magic users - sign with Magic wallet
        signature = await signMagicVote(pollAddress, optionIndex);
      } else {
        // For wallet users - sign with their wallet
        signature = await signWalletVote(pollAddress, optionIndex);
      }
      
      // Send to backend for relaying
      const response = await api.post(`/polls/${id}/vote`, {
        optionIndex,
        voterAddress: account,
        signature
      });
      
      return response.data;
    } catch (error) {
      console.error("Error voting on poll:", error);
      throw error;
    }
  };
  
  // Sign a vote with Magic
  const signMagicVote = async (pollAddress, optionIndex) => {
    try {
      // Get user's nonce
      const nonceResponse = await api.get(`/polls/nonce/${pollAddress}/${account}`);
      const nonce = nonceResponse.data.data.nonce;
      
      // Create domain data
      const domain = {
        name: 'TruthPoll',
        version: '1',
        chainId: chainId || 80002, // Polygon Amoy
        verifyingContract: pollAddress
      };
      
      // Define types
      const types = {
        Vote: [
          { name: 'voter', type: 'address' },
          { name: 'option', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }
        ]
      };
      
      // Create value
      const value = {
        voter: account,
        option: optionIndex,
        nonce: nonce
      };
      
      // Sign typed data
      const signer = provider.getSigner();
      const signature = await signer._signTypedData(domain, types, value);
      
      return signature;
    } catch (error) {
      console.error("Error signing with Magic:", error);
      throw error;
    }
  };
  
  // Sign a vote with wallet
  const signWalletVote = async (pollAddress, optionIndex) => {
    try {
      // Create a message hash for the smart wallet to execute
      const pollInterface = new ethers.utils.Interface([
        'function vote(uint256 _option) external'
      ]);
      
      // Encode the vote function call
      const callData = pollInterface.encodeFunctionData('vote', [optionIndex]);
      
      // Create message hash
      const messageHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'bytes32'],
          [pollAddress, 0, ethers.utils.keccak256(callData)]
        )
      );
      
      // Sign the message
      const signer = provider.getSigner();
      const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
      
      return signature;
    } catch (error) {
      console.error("Error signing with wallet:", error);
      throw error;
    }
  };
  
  // Claim rewards
  const claimReward = async (pollAddress) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      // Sign the claim
      let signature;
      
      if (authType === 'magic') {
        // For Magic users
        signature = await signMagicRewardClaim(pollAddress);
      } else {
        // For wallet users
        signature = await signWalletRewardClaim(pollAddress);
      }
      
      // Send to backend for relaying
      const response = await api.post(`/polls/claim-reward`, {
        pollAddress,
        signature
      });
      
      return response.data;
    } catch (error) {
      console.error("Error claiming reward:", error);
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
        chainId: chainId || 80002, // Polygon Amoy
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
      const signer = provider.getSigner();
      const signature = await signer._signTypedData(domain, types, value);
      
      return signature;
    } catch (error) {
      console.error("Error signing reward claim with Magic:", error);
      throw error;
    }
  };
  
  // Sign a reward claim with wallet
  const signWalletRewardClaim = async (pollAddress) => {
    try {
      // Create a message hash for the smart wallet to execute
      const pollInterface = new ethers.utils.Interface([
        'function claimReward() external'
      ]);
      
      // Encode the claimReward function call
      const callData = pollInterface.encodeFunctionData('claimReward', []);
      
      // Create message hash
      const messageHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'bytes32'],
          [pollAddress, 0, ethers.utils.keccak256(callData)]
        )
      );
      
      // Sign the message
      const signer = provider.getSigner();
      const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
      
      return signature;
    } catch (error) {
      console.error("Error signing reward claim with wallet:", error);
      throw error;
    }
  };
  
  // Get polls
  const getPolls = async (params = {}) => {
    try {
      const response = await api.get('/polls', { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching polls:", error);
      throw error;
    }
  };
  
  // Get single poll
  const getPoll = async (id) => {
    try {
      const response = await api.get(`/polls/${id}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching poll:", error);
      throw error;
    }
  };
  
  // Create poll
  const createPoll = async (pollData) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      const response = await api.post('/polls', {
        ...pollData,
        creator: account
      });
      
      return response.data;
    } catch (error) {
      console.error("Error creating poll:", error);
      throw error;
    }
  };
  
  // Get claimable rewards
  const getClaimableRewards = async () => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      const response = await api.get(`/polls/claimable-rewards/${account}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching claimable rewards:", error);
      throw error;
    }
  };
  
  return (
    <Web3Context.Provider
      value={{
        provider,
        signer,
        account,
        chainId,
        isConnected,
        smartWalletAddress,
        loading,
        error,
        authType,
        magic,
        showAuthModal,
        openAuthModal,
        closeAuthModal,
        connectWallet,
        loginWithMagic,
        logout,
        votePoll,
        getPolls,
        getPoll,
        createPoll,
        claimReward,
        getClaimableRewards
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};