// src/context/AuthContext.js

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import createMagicInstance from '../config/magic';
import api from '../utils/api';
import logger from '../utils/logger';

// Create context
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Authentication state
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [authType, setAuthType] = useState(null); // 'magic' or 'wallet'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [magic, setMagic] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  
  // UI state
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Open/close auth modal
  const openAuthModal = useCallback(() => setShowAuthModal(true), []);
  const closeAuthModal = useCallback(() => setShowAuthModal(false), []);
  
  // Initialize on mount
  useEffect(() => {
    checkExistingAuth();
  }, []);
  
  // Check if user is already authenticated
  const checkExistingAuth = async () => {
    try {
      logger.info("Checking for existing authentication...");
      
      // First check for Magic session
      const magicInstance = createMagicInstance();
      if (magicInstance) {
        setMagic(magicInstance);
        const isLoggedIn = await magicInstance.user.isLoggedIn();
        
        if (isLoggedIn) {
          logger.info("User is logged in with Magic");
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
      logger.error("Error checking authentication:", error);
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
        logger.error("Error getting network:", err);
      }
      
      setLoading(false);
      
      logger.info("Magic user initialized:", userMetadata.publicAddress);
      
      return {
        account: userMetadata.publicAddress,
        provider: magicProvider,
        signer: magicProvider.getSigner()
      };
    } catch (error) {
      logger.error("Error initializing Magic user:", error);
      setLoading(false);
      throw error;
    }
  };
  
  // Initialize wallet connection
  const initWalletConnection = async () => {
    try {
      if (!window.ethereum) {
        logger.warn("No ethereum provider found");
        setLoading(false);
        return null;
      }
      
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(web3Provider);
      
      // Get network
      const network = await web3Provider.getNetwork();
      setChainId(network.chainId);
      
      // Check if already connected
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length > 0) {
        logger.info("Wallet already connected:", accounts[0]);
        setAccount(accounts[0]);
        setSigner(web3Provider.getSigner());
        setIsConnected(true);
        setAuthType('wallet');
        
        // Set up listeners
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
        
        return {
          account: accounts[0],
          provider: web3Provider,
          signer: web3Provider.getSigner()
        };
      }
      
      setLoading(false);
      return null;
    } catch (error) {
      logger.error("Error initializing wallet connection:", error);
      setLoading(false);
      throw error;
    }
  };
  
  // Handle accounts changed event
  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      // User disconnected
      setAccount(null);
      setSigner(null);
      setIsConnected(false);
      setAuthType(null);
    } else {
      // Account changed
      setAccount(accounts[0]);
      if (provider) {
        setSigner(provider.getSigner());
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
      logger.info("Connected accounts:", accounts);
      
      if (accounts.length > 0) {
        // Create provider if not exists
        if (!provider) {
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(web3Provider);
          
          // Get network
          const network = await web3Provider.getNetwork();
          setChainId(network.chainId);
          logger.info("Connected to network:", network);
          
          // Explicitly set signer
          const newSigner = web3Provider.getSigner();
          setSigner(newSigner);
          
          // Verify signer works
          try {
            const signerAddress = await newSigner.getAddress();
            logger.info("Signer address verified:", signerAddress);
          } catch (signerError) {
            logger.error("Signer error:", signerError);
            setError('Failed to access wallet. Please reconnect.');
            setLoading(false);
            return false;
          }
        } else {
          // If provider exists, refresh signer
          const refreshedSigner = provider.getSigner();
          setSigner(refreshedSigner);
        }
        
        setAccount(accounts[0]);
        setIsConnected(true);
        setAuthType('wallet');
        
        setLoading(false);
        return true;
      }
      
      setLoading(false);
      return false;
    } catch (error) {
      logger.error("Error connecting wallet:", error);
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
      logger.error("Error logging in with Magic:", error);
      setError(error.message || 'Failed to login');
      setLoading(false);
      return false;
    }
  };
  
  // Updated logout function with proper MetaMask disconnection
  const logout = async () => {
    try {
      // For Magic users, use their logout
      if (authType === 'magic' && magic) {
        await magic.user.logout();
      }
      
      // 1. Tell MetaMask we're disconnecting (if possible)
      if (window.ethereum) {
        try {
          // First try the proper disconnect (EIP-1193)
          if (window.ethereum.request) {
            // This is the key method that properly disconnects
            await window.ethereum.request({
              method: 'wallet_revokePermissions',
              params: [{ eth_accounts: {} }]
            });
          }
        } catch (disconnectError) {
          logger.info("Could not revoke permissions:", disconnectError);
          // Continue with fallback
        }
      }
      
      // 2. Remove all event listeners
      if (window.ethereum) {
        if (window.ethereum.removeAllListeners) {
          window.ethereum.removeAllListeners();
        } else {
          // Fallback for providers without removeAllListeners
          window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener?.('chainChanged', handleChainChanged);
          window.ethereum.removeListener?.('disconnect', () => {});
          window.ethereum.removeListener?.('connect', () => {});
        }
      }
      
      // 3. Clear localStorage and sessionStorage
      const keysToRemove = [
        'walletProvider',
        'connectedWallet',
        'userAccount',
        'walletconnect',
        'WALLETCONNECT_DEEPLINK_CHOICE',
        'smartWalletAddress',
        'web3-provider-name',
      ];
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear relevant session storage items
      const sessionKeysToRemove = Object.keys(sessionStorage);
      sessionKeysToRemove.forEach(key => {
        if (key.includes('wallet') || key.includes('web3') || key.includes('connect')) {
          sessionStorage.removeItem(key);
        }
      });
      
      // 4. Reset state variables
      setAccount(null);
      setSigner(null);
      setIsConnected(false);
      setAuthType(null);
      setProvider(null);
      setChainId(null);
      
      // 5. Signal logout to other contexts
      window.dispatchEvent(new CustomEvent('auth:logout'));
      
      return true;
    } catch (error) {
      logger.error("Error logging out:", error);
      return false;
    }
  };
  
  // Get current connection state
  const getConnectionState = useCallback(() => {
    return {
      isConnected,
      account,
      authType, 
      provider,
      signer,
      chainId
    };
  }, [isConnected, account, authType, provider, signer, chainId]);
  
  return (
    <AuthContext.Provider
      value={{
        isConnected,
        account,
        authType,
        provider,
        signer,
        chainId,
        loading,
        error,
        showAuthModal,
        openAuthModal,
        closeAuthModal,
        connectWallet,
        loginWithMagic,
        logout,
        getConnectionState
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};