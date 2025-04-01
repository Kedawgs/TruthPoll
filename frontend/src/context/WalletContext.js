// src/context/WalletContext.js
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { ethers } from 'ethers';
import { AuthContext } from './AuthContext';
import api from '../utils/api';
import logger from '../utils/logger';
import { requestWalletDeployment } from '../utils/web3Helper';

// Create context
export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const { isConnected, account, authType, provider, signer, openAuthModal } = useContext(AuthContext);
  
  // Smart wallet state
  const [smartWalletAddress, setSmartWalletAddress] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [isSmartWalletDeployed, setIsSmartWalletDeployed] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState(null);
  const [walletData, setWalletData] = useState(null); // Store complete wallet data
  
  // USDT token address
  const [usdtAddress] = useState(process.env.REACT_APP_USDT_ADDRESS);
  
  // Listen for logout events
  useEffect(() => {
    const handleLogout = () => {
      // Reset wallet state on logout
      logger.info("WalletContext: Handling logout event");
      setSmartWalletAddress(null);
      setIsSmartWalletDeployed(false);
      setUsdtBalance("0.00");
      setWalletLoading(false);
      setWalletError(null);
      setWalletData(null);
    };
    
    window.addEventListener('auth:logout', handleLogout);
    
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);
  
  // Listen for wallet authentication required events
  useEffect(() => {
    const handleWalletAuthRequired = () => {
      logger.info("Authentication required for wallet operations");
      // Reset error state and prompt for authentication
      setWalletError("Authentication required. Please sign in first.");
      // If we have access to the auth modal, open it
      if (openAuthModal) {
        openAuthModal();
      }
    };
    
    window.addEventListener('wallet:auth:required', handleWalletAuthRequired);
    
    return () => {
      window.removeEventListener('wallet:auth:required', handleWalletAuthRequired);
    };
  }, [openAuthModal]);
  
  // Load smart wallet data when auth state changes
  useEffect(() => {
    if (isConnected && account) {
      if (authType === 'wallet') {
        // For regular wallet users, get their smart wallet
        getSmartWalletAddress(account);
      }
      
      // Get USDT balance for any connected user
      refreshUSDTBalance();
    } else {
      // Reset wallet state when disconnected
      setSmartWalletAddress(null);
      setIsSmartWalletDeployed(false);
      setWalletData(null);
    }
  }, [isConnected, account, authType]);
  
  // Get smart wallet address from the backend - optimized to store complete data
  const getSmartWalletAddress = async (userAddress) => {
    try {
      setWalletLoading(true);
      // Only proceed if this is a wallet user (not Magic)
      if (authType === 'magic') {
        setWalletLoading(false);
        return null;
      }
      
      const response = await api.get(`/smart-wallets/${userAddress}`);
      
      if (response.data.success) {
        // Store complete wallet data
        const walletData = response.data.data;
        setWalletData(walletData);
        
        // Update individual state variables for backward compatibility
        setSmartWalletAddress(walletData.address);
        setIsSmartWalletDeployed(walletData.isDeployed);
        
        logger.info("Smart wallet data retrieved:", walletData);
        setWalletLoading(false);
        return walletData.address;
      }
      setWalletLoading(false);
      return null;
    } catch (error) {
      logger.error("Error getting smart wallet address:", error);
      setWalletError("Failed to retrieve smart wallet information");
      setWalletLoading(false);
      return null;
    }
  };
  
  // Deploy smart wallet if needed - IMPROVED to use stored wallet data
  const deploySmartWalletIfNeeded = async () => {
    try {
      setWalletLoading(true);
      setWalletError(null);
      
      // Skip for Magic users
      if (authType === 'magic' || !account) {
        setWalletLoading(false);
        return null;
      }
      
      // Check authentication status using only isConnected from AuthContext
      if (!isConnected) {
        logger.warn("Authentication required for wallet deployment");
        setWalletError("Authentication required. Please sign in first.");
        // Dispatch event for components to respond to
        window.dispatchEvent(new CustomEvent('wallet:auth:required'));
        setWalletLoading(false);
        // If we have access to the auth modal, open it
        if (openAuthModal) {
          openAuthModal();
        }
        throw new Error("Authentication required. Please sign in first.");
      }
      
      // Use stored wallet data if available, or fetch it if not
      let currentWalletData = walletData;
      if (!currentWalletData) {
        // Fetch wallet data if not already available
        await getSmartWalletAddress(account);
        currentWalletData = walletData;
      }
      
      // Determine if deployment is needed
      let needsDeployment = false;
      let walletAddress = null;
      
      if (currentWalletData) {
        walletAddress = currentWalletData.address;
        // Check if it's not yet deployed
        if (!currentWalletData.isDeployed) {
          needsDeployment = true;
        } else {
          // Already deployed, return address
          setWalletLoading(false);
          return walletAddress;
        }
      } else {
        // No wallet data found, need to create a new wallet
        needsDeployment = true;
      }
      
      // Deploy if needed
      if (needsDeployment) {
        try {
          // Call the deployment function which handles signature creation
          logger.info(`Requesting deployment for account: ${account}`);
          const result = await requestWalletDeployment(account, window.ethereum);
          
          if (result.success) {
            // Update state with new wallet data
            const newWalletData = {
              address: result.data.address,
              isDeployed: true
            };
            
            setWalletData(newWalletData);
            setSmartWalletAddress(result.data.address);
            setIsSmartWalletDeployed(true);
            setWalletLoading(false);
            return result.data.address;
          } else {
            throw new Error(result.error || 'Deployment failed');
          }
        } catch (deployError) {
          // Check for auth-related errors
          if (deployError.message.includes("Authentication required") || 
              (deployError.response && deployError.response.status === 401)) {
            logger.error("Authentication error during wallet deployment:", deployError);
            setWalletError('Authentication required. Please sign in first.');
            // If we have access to the auth modal, open it
            if (openAuthModal) {
              openAuthModal();
            }
          } else {
            logger.error("Smart wallet deployment error:", deployError);
            setWalletError('Failed to deploy smart wallet: ' + (deployError.message || 'Unknown error'));
          }
          setWalletLoading(false);
          throw deployError;
        }
      }
      
      setWalletLoading(false);
      return walletAddress;
    } catch (error) {
      logger.error("Error deploying smart wallet:", error);
      setWalletError(error.message || 'Smart wallet deployment failed');
      setWalletLoading(false);
      throw error;
    }
  };
  
  // Get USDT balance - works for both Magic and wallet users
  const getUSDTBalance = useCallback(async () => {
    try {
      // For Magic users, use their Ethereum address directly
      // For wallet users, use the smart wallet address
      const walletToCheck = authType === 'magic' 
        ? account  // Magic user's address
        : smartWalletAddress;  // Smart wallet for non-Magic users
      
      // Log which wallet we're checking
      if (authType === 'magic') {
        logger.info(`Checking balance for Magic user: ${walletToCheck}`);
      } else {
        if (!walletToCheck) {
          logger.info("Smart wallet not available yet");
          return "0.00";  // Early return for wallet users without smart wallet
        }
        logger.info(`Checking balance for smart wallet: ${walletToCheck}`);
      }
      
      // If we have a provider and wallet address, try to get the balance
      if (provider && walletToCheck) {
        try {
          const testnetUsdtAddress = usdtAddress;
          logger.info(`Using token address: ${testnetUsdtAddress}`);
          
          // Use a simplified token ABI with just balanceOf
          const tokenAbi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
          ];
          
          const tokenContract = new ethers.Contract(
            testnetUsdtAddress, 
            tokenAbi, 
            provider
          );
          
          // Try to get decimals, default to a6 for USDT
          let decimals = 6;
          try {
            const tokenDecimals = await tokenContract.decimals();
            decimals = tokenDecimals;
            logger.info(`Token decimals: ${decimals}`);
          } catch (decimalError) {
            logger.info("Could not get token decimals, using default (6)");
          }
          
          // Get balance
          const balance = await tokenContract.balanceOf(walletToCheck);
          logger.info(`Raw balance: ${balance.toString()}`);
          
          // Format balance with decimals
          const formattedBalance = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(2);
          logger.info(`Formatted balance: ${formattedBalance}`);
          
          return formattedBalance;
        } catch (error) {
          logger.error("Error getting token balance from blockchain:", error);
          // For development, return mock balance
          if (process.env.NODE_ENV === 'development') {
            logger.info("Using mock balance during development");
            return "100.00";  // Mock balance for development
          }
          return "0.00";
        }
      }
      
      // Fallback if no provider or wallet
      return "0.00";
    } catch (error) {
      logger.error("Error in getUSDTBalance:", error);
      return "0.00";
    }
  }, [account, authType, provider, smartWalletAddress, usdtAddress]);
  
  // Refresh USDT balance
  const refreshUSDTBalance = useCallback(async () => {
    if (isConnected) {
      const balance = await getUSDTBalance();
      setUsdtBalance(balance);
      return balance;
    }
    return "0.00";
  }, [isConnected, getUSDTBalance]);
  
  // Sign a transaction for a smart wallet
  const signSmartWalletTransaction = async (targetAddress, callData, value = 0) => {
    try {
      if (!isConnected || !provider) {
        throw new Error("Wallet not connected");
      }
      
      if (authType !== 'wallet') {
        throw new Error("Smart wallet operations only supported for wallet users");
      }
      
      // Make sure we have an ethereum provider
      if (!window.ethereum) {
        throw new Error("MetaMask not found");
      }
      
      // Create a fresh Web3Provider and signer
      const freshProvider = new ethers.providers.Web3Provider(window.ethereum);
      
      // Request account access again to ensure we have permission
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Get a fresh signer
      const freshSigner = freshProvider.getSigner();
      const address = await freshSigner.getAddress();
      logger.info("Signing with address:", address);
      
      // Create message hash for the smart wallet to execute
      const messageHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['address', 'uint256', 'bytes32'],
          [targetAddress, ethers.BigNumber.from(value), ethers.utils.keccak256(callData)]
        )
      );
      
      // Sign the message with fresh signer
      const signature = await freshSigner.signMessage(ethers.utils.arrayify(messageHash));
      
      return signature;
    } catch (error) {
      logger.error("Error signing smart wallet transaction:", error);
      throw error;
    }
  };
  
  return (
    <WalletContext.Provider
      value={{
        smartWalletAddress,
        usdtBalance,
        isSmartWalletDeployed,
        walletLoading,
        walletError,
        walletData, // Expose complete wallet data
        getSmartWalletAddress,
        deploySmartWalletIfNeeded,
        getUSDTBalance,
        refreshUSDTBalance,
        signSmartWalletTransaction
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};