import React, { createContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import createMagicInstance from '../config/magic';
import api from '../utils/api';

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
  const [magic, setMagic] = useState(null);
  const [authType, setAuthType] = useState(null); // 'magic' or 'wallet'

  // Check on mount if user is already connected via Magic
  useEffect(() => {
    const checkMagicAuth = async () => {
      try {
        console.log("Checking for existing Magic session...");
        const magicInstance = createMagicInstance();
        
        if (magicInstance) {
          setMagic(magicInstance);
          
          // Check if user is already logged in with Magic
          const isLoggedIn = await magicInstance.user.isLoggedIn();
          console.log("Magic user is logged in:", isLoggedIn);
          
          if (isLoggedIn) {
            // If getMetadata isn't available, we can work with what we have
            // Get the Ethereum provider from Magic
            const magicProvider = new ethers.providers.Web3Provider(magicInstance.rpcProvider);
            
            // Get the signer address directly from the provider
            const signer = magicProvider.getSigner();
            const userAddress = await signer.getAddress();
            
            console.log("Got user address from provider:", userAddress);
            
            // Update state with user info
            setProvider(magicProvider);
            setAccount(userAddress);
            setSigner(signer);
            setIsConnected(true);
            setAuthType('magic');
            setProxyWallet(userAddress);
            
            console.log("Magic session restored successfully");
          } else if (window.ethereum) {
            // Check for wallet connection
            await initWalletConnection();
          }
        } else if (window.ethereum) {
          // Check for wallet connection
          await initWalletConnection();
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error checking Magic auth:", error);
        
        // Fall back to checking wallet
        if (window.ethereum) {
          await initWalletConnection();
        }
        
        setLoading(false);
      }
    };
    
    checkMagicAuth();
  }, []);

  const initWalletConnection = async () => {
    try {
      console.log("Initializing wallet connection...");
      
      // Create ethers provider
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(web3Provider);

      // Get network
      const network = await web3Provider.getNetwork();
      setChainId(network.chainId);

      // Check if user is already connected
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length > 0) {
        console.log("Wallet already connected:", accounts[0]);
        setAccount(accounts[0]);
        setSigner(web3Provider.getSigner());
        setIsConnected(true);
        setAuthType('wallet');
        
        // Get or create proxy wallet
        await getOrCreateProxyWallet(accounts[0]);
      }

      // Set up event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      console.log("Wallet initialization complete");
    } catch (error) {
      console.error('Error initializing wallet:', error);
    }
  };

  const connectWithMagic = async (magicInstance) => {
    try {
      console.log("Connecting with Magic...");
      if (!magicInstance) {
        throw new Error('Magic instance is not available');
      }
      
      // Get Magic provider
      const magicProvider = new ethers.providers.Web3Provider(magicInstance.rpcProvider);
      setProvider(magicProvider);
      
      // Get user info
      const userMetadata = await magicInstance.user.getMetadata();
      console.log("Magic user metadata:", userMetadata);
      
      if (!userMetadata || !userMetadata.publicAddress) {
        throw new Error('Failed to get user metadata from Magic');
      }
      
      setAccount(userMetadata.publicAddress);
      
      // Set network
      try {
        const network = await magicProvider.getNetwork();
        setChainId(network.chainId);
      } catch (err) {
        console.error("Error getting network:", err);
      }
      
      // Set signer
      setSigner(magicProvider.getSigner());
      
      // IMPORTANT: Update these states
      setIsConnected(true);
      setAuthType('magic');
      
      // Use Magic address as proxy wallet
      setProxyWallet(userMetadata.publicAddress);
      
      console.log("Magic connection successful. Connected address:", userMetadata.publicAddress);
      return true;
    } catch (error) {
      console.error('Error connecting with Magic:', error);
      setError('Failed to connect with Magic: ' + error.message);
      return false;
    }
  };

  const loginWithMagic = async (method, params) => {
    try {
      setLoading(true);
      console.log(`Starting Magic login with ${method}...`);
      
      const magicInstance = createMagicInstance();
      setMagic(magicInstance);
      
      if (!magicInstance) {
        throw new Error('Magic not initialized');
      }
      
      if (method === 'email') {
        await magicInstance.auth.loginWithMagicLink({ email: params.email });
        console.log("Email login successful, connecting...");
        const success = await connectWithMagic(magicInstance);
        setLoading(false);
        return success;
      } else if (method === 'google') {
        console.log("Starting Google OAuth flow...");
        
        // For OAuth, we just redirect and don't wait for the result here
        await magicInstance.oauth.loginWithRedirect({
          provider: 'google',
          redirectURI: window.location.origin
        });
        
        // This won't execute as the page will redirect
        console.log("Google OAuth started, redirecting...");
        return false;
      } else {
        throw new Error('Unsupported login method');
      }
    } catch (error) {
      console.error('Error logging in with Magic:', error);
      setError('Failed to log in: ' + error.message);
      setLoading(false);
      return false;
    }
  };

  const completeMagicOAuthLogin = async () => {
    try {
      console.log("Completing Magic OAuth login...");
      const magicInstance = createMagicInstance();
      setMagic(magicInstance);
      
      if (!magicInstance) {
        console.error('Magic not initialized in completeMagicOAuthLogin');
        return false;
      }
      
      // Get redirect result
      console.log("Getting OAuth redirect result...");
      const result = await magicInstance.oauth.getRedirectResult();
      console.log("OAuth result:", result);
      
      if (result) {
        console.log("OAuth successful, connecting with Magic...");
        const success = await connectWithMagic(magicInstance);
        
        if (success) {
          console.log("Magic connection after OAuth successful");
          
          // Force a manual state update to ensure UI reflects the auth state
          setTimeout(() => {
            setIsConnected(true);
            setAuthType('magic');
          }, 100);
          
          return true;
        } else {
          console.error("Failed to connect with Magic after OAuth");
          return false;
        }
      } else {
        console.error("No result from OAuth redirect");
        return false;
      }
    } catch (error) {
      console.error('Error completing OAuth login:', error);
      return false;
    }
  };

  const connectWalletWithProvider = async (providerName) => {
    try {
      setLoading(true);
      console.log(`Connecting with ${providerName}...`);
      
      const magicInstance = createMagicInstance();
      setMagic(magicInstance);
      
      if (!magicInstance && providerName !== 'metamask') {
        throw new Error('Magic not initialized');
      }
      
      if (providerName === 'metamask') {
        // Use default MetaMask connection
        return await connectWallet();
      }
      
      // For other wallets, use Magic Connect
      await magicInstance.connect.connectWith(providerName);
      
      const success = await connectWithMagic(magicInstance);
      setAuthType('magic');
      setLoading(false);
      return success;
    } catch (error) {
      console.error(`Error connecting with ${providerName}:`, error);
      setError(`Failed to connect with ${providerName}`);
      setLoading(false);
      return false;
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      // User disconnected
      setAccount(null);
      setSigner(null);
      setIsConnected(false);
      setProxyWallet(null);
      setAuthType(null);
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
        return false;
      }

      setLoading(true);
      console.log("Connecting with MetaMask...");
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length > 0) {
        // Create ethers provider if not exists
        if (!provider) {
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(web3Provider);
          setSigner(web3Provider.getSigner());
        } else {
          setSigner(provider.getSigner());
        }
        
        setAccount(accounts[0]);
        setIsConnected(true);
        setAuthType('wallet');
        
        await getOrCreateProxyWallet(accounts[0]);
        setLoading(false);
        
        console.log("Wallet connected successfully:", accounts[0]);
        return true;
      }
      
      setLoading(false);
      return false;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError('Failed to connect wallet');
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      console.log("Logging out. Auth type:", authType);
      
      if (authType === 'magic' && magic) {
        await magic.user.logout();
        console.log("Magic logout successful");
      }
      
      // Reset state
      setAccount(null);
      setSigner(null);
      setIsConnected(false);
      setProxyWallet(null);
      setAuthType(null);
      
      console.log("Logout complete, state reset");
      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      return false;
    }
  };

  const getOrCreateProxyWallet = async (userAddress) => {
    // Skip proxy wallet creation for Magic users as Magic.link handles this
    if (authType === 'magic') {
      return;
    }
    
    try {
      console.log("Creating proxy wallet for:", userAddress);
      const response = await api.post('/wallets', {
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

      const response = await api.post('/polls', {
        ...pollData,
        creator: account
      });

      return response.data;
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  };

  const getPolls = async (params = {}) => {
    try {
      const response = await api.get('/polls', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting polls:', error);
      throw error;
    }
  };

  const getPoll = async (id) => {
    try {
      const response = await api.get(`/polls/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error getting poll:', error);
      throw error;
    }
  };

  const votePoll = async (id, optionIndex) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }

      // Use account address directly for Magic users, otherwise use proxy wallet
      const voterAddress = authType === 'magic' ? account : proxyWallet;
      
      if (!voterAddress) {
        throw new Error('Wallet not connected or proxy wallet not set up');
      }

      const response = await api.post(`/polls/${id}/vote`, {
        optionIndex,
        voterAddress
      });

      return response.data;
    } catch (error) {
      console.error('Error voting on poll:', error);
      throw error;
    }
  };

  // Log state changes for debugging
  useEffect(() => {
    console.log("Auth state updated:", { 
      isConnected, 
      authType, 
      account: account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : null
    });
  }, [isConnected, authType, account]);

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
        authType,
        magic,
        connectWallet,
        connectWalletWithProvider,
        loginWithMagic,
        completeMagicOAuthLogin,
        logout,
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