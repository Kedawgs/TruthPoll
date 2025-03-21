import React, { createContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';

export const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [proxyWallet, setProxyWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initWeb3 = async () => {
      try {
        if (window.ethereum) {
          // Create ethers provider
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(web3Provider);

          // Get network
          const network = await web3Provider.getNetwork();
          setChainId(network.chainId);

          // Check if user is already connected
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setSigner(web3Provider.getSigner());
            setIsConnected(true);
            
            // Get or create proxy wallet
            await getOrCreateProxyWallet(accounts[0]);
          }

          // Set up event listeners
          window.ethereum.on('accountsChanged', handleAccountsChanged);
          window.ethereum.on('chainChanged', handleChainChanged);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error initializing web3', error);
        setError('Error connecting to the blockchain');
        setLoading(false);
      }
    };

    initWeb3();

    // Cleanup function
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      // User disconnected
      setAccount(null);
      setSigner(null);
      setIsConnected(false);
      setProxyWallet(null);
    } else {
      // Account changed
      setAccount(accounts[0]);
      if (provider) {
        setSigner(provider.getSigner());
        await getOrCreateProxyWallet(accounts[0]);
      }
    }
  };

  const handleChainChanged = () => {
    // Reload page on chain change
    window.location.reload();
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setError('MetaMask is not installed. Please install it to use this app.');
        return;
      }

      setLoading(true);
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setSigner(provider.getSigner());
        setIsConnected(true);
        
        await getOrCreateProxyWallet(accounts[0]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error connecting wallet', error);
      setError('Failed to connect wallet');
      setLoading(false);
    }
  };

  const getOrCreateProxyWallet = async (userAddress) => {
    try {
      console.log("Creating proxy wallet for:", userAddress);
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/wallets`, {
        userAddress
      });
  
      if (response.data.success) {
        setProxyWallet(response.data.data.address);
        console.log("Proxy wallet created successfully:", response.data.data.address);
      }
    } catch (error) {
      console.error('Error creating proxy wallet:', error);
      // Don't set an error state here - just log it
      // This prevents blocking the UI flow for users
    }
  };

  // API functions to interact with backend
  
  const createPoll = async (pollData) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/polls`, {
        ...pollData,
        creator: account
      });

      return response.data;
    } catch (error) {
      console.error('Error creating poll', error);
      throw error;
    }
  };

  const getPolls = async (params = {}) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/polls`, { params });
      return response.data;
    } catch (error) {
      console.error('Error getting polls', error);
      throw error;
    }
  };

  const getPoll = async (id) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/polls/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error getting poll', error);
      throw error;
    }
  };

  const votePoll = async (id, optionIndex) => {
    try {
      if (!isConnected || !proxyWallet) {
        throw new Error('Wallet not connected or proxy wallet not set up');
      }

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/polls/${id}/vote`, {
        optionIndex,
        voterAddress: proxyWallet
      });

      return response.data;
    } catch (error) {
      console.error('Error voting on poll', error);
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
        proxyWallet,
        loading,
        error,
        connectWallet,
        createPoll,
        getPolls,
        getPoll,
        votePoll
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};