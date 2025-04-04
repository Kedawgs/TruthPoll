// src/context/WalletContext.js
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { AuthContext } from './AuthContext';
import api from '../utils/api';
import logger from '../utils/logger';
import { requestWalletDeployment } from '../utils/web3Helper';

// Create context
export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const { isConnected, account, authType, provider, openAuthModal } = useContext(AuthContext);
  
  // Smart wallet state
  const [smartWalletAddress, setSmartWalletAddress] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [isSmartWalletDeployed, setIsSmartWalletDeployed] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState(null);
  const [walletData, setWalletData] = useState(null); // Store complete wallet data
  
  // WebSocket state with refs to prevent update loops
  const [wsConnected, setWsConnected] = useState(false);
  const [wsSubscriptionActive, setWsSubscriptionActive] = useState(false);
  const wsProviderRef = useRef(null);
  const wsSubscriptionIdRef = useRef(null);
  const wsConnectionTimeoutRef = useRef(null);
  const wsReconnectTimeoutRef = useRef(null);
  const wsHeartbeatIntervalRef = useRef(null);
  const fallbackPollingIntervalRef = useRef(null);
  const lastBalanceRef = useRef("0.00");
  
  // USDT token address
  const [usdtAddress] = useState(process.env.REACT_APP_USDT_ADDRESS);
  
  // WebSocket URL from environment
  const wsUrlRef = useRef(process.env.REACT_APP_POLYGON_AMOY_WS_URL);
  
  // IMPORTANT: Define functions in order of dependencies
  // First define functions that don't depend on other functions
  
  // Check balance via standard provider (HTTP RPC)
  const checkBalanceViaProvider = useCallback(async () => {
    try {
      // Skip if not connected or no provider
      if (!isConnected || !provider) {
        return;
      }
      
      const walletToCheck = authType === 'magic' 
        ? account
        : smartWalletAddress;
        
      if (!walletToCheck || !usdtAddress) {
        return;
      }
      
      logger.info(`Checking balance for wallet: ${walletToCheck}`);
      
      // ABI for token contract
      const tokenAbi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];
      
      // Create contract interface
      const tokenContract = new ethers.Contract(
        usdtAddress,
        tokenAbi,
        provider
      );
      
      // Get decimals
      let decimals = 6; // Default for USDT
      try {
        const tokenDecimals = await tokenContract.decimals();
        decimals = tokenDecimals.toNumber ? tokenDecimals.toNumber() : Number(tokenDecimals);
      } catch (decimalError) {
        logger.debug('Error getting decimals, using default (6):', decimalError.message);
      }
      
      // Get balance
      const balance = await tokenContract.balanceOf(walletToCheck);
      const formattedBalance = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(2);
      
      logger.info(`Current balance: ${formattedBalance}`);
      
      // Only update if balance has changed
      if (formattedBalance !== lastBalanceRef.current) {
        logger.info(`Balance changed: ${lastBalanceRef.current} -> ${formattedBalance}`);
        lastBalanceRef.current = formattedBalance;
        setUsdtBalance(formattedBalance);
      }
      
      return formattedBalance;
    } catch (error) {
      logger.error('Error checking balance via provider:', error);
      return null;
    }
  }, [isConnected, provider, authType, account, smartWalletAddress, usdtAddress]);
  
  // Get USDT balance - works for both Magic and wallet users
  const getUSDTBalance = useCallback(async () => {
    return await checkBalanceViaProvider();
  }, [checkBalanceViaProvider]);
  
  // Refresh USDT balance
  const refreshUSDTBalance = useCallback(async () => {
    if (isConnected) {
      const balance = await checkBalanceViaProvider();
      if (balance) {
        return balance;
      }
    }
    return "0.00";
  }, [isConnected, checkBalanceViaProvider]);
  
  // Set up fallback polling for balance updates
  const setupFallbackPolling = useCallback(() => {
    // Clear any existing polling
    if (fallbackPollingIntervalRef.current) {
      clearInterval(fallbackPollingIntervalRef.current);
      fallbackPollingIntervalRef.current = null;
    }
    
    logger.info('Setting up fallback balance polling');
    
    // Set up polling interval
    fallbackPollingIntervalRef.current = setInterval(() => {
      if (isConnected) {
        checkBalanceViaProvider();
      } else {
        // Stop polling if disconnected
        clearInterval(fallbackPollingIntervalRef.current);
        fallbackPollingIntervalRef.current = null;
      }
    }, 30000); // 30-second polling interval
    
    // Do an immediate check
    checkBalanceViaProvider();
  }, [isConnected, checkBalanceViaProvider]);
  
  // Handle log notification
  const handleLogNotification = useCallback(async (logData) => {
    try {
      if (!logData || !logData.topics || logData.topics.length < 3) {
        return;
      }
      
      // Check if this is a Transfer event by checking the first topic (event signature)
      const transferEventSignature = ethers.utils.id('Transfer(address,address,uint256)');
      if (logData.topics[0] !== transferEventSignature) {
        return;
      }
      
      // Decode the from and to addresses from the topics
      const fromAddress = ethers.utils.defaultAbiCoder.decode(['address'], logData.topics[1])[0].toLowerCase();
      const toAddress = ethers.utils.defaultAbiCoder.decode(['address'], logData.topics[2])[0].toLowerCase();
      
      // Get our wallet address based on auth type
      const walletAddress = (authType === 'magic' ? account : smartWalletAddress).toLowerCase();
      
      // Check if our wallet is involved in this transfer
      if (fromAddress === walletAddress || toAddress === walletAddress) {
        logger.info(`Transfer event detected: ${fromAddress === walletAddress ? 'outgoing' : 'incoming'}`);
        
        // Check balance after a short delay to ensure blockchain state is updated
        setTimeout(() => {
          checkBalanceViaProvider();
        }, 2000);
      }
    } catch (error) {
      logger.error('Error handling log notification:', error);
    }
  }, [account, authType, smartWalletAddress, checkBalanceViaProvider]);
  
  // Set up heartbeat to keep connection alive
  const setupHeartbeat = useCallback(() => {
    // Clear any existing heartbeat
    if (wsHeartbeatIntervalRef.current) {
      clearInterval(wsHeartbeatIntervalRef.current);
    }
    
    logger.info('Setting up WebSocket heartbeat');
    
    // Set up heartbeat interval
    wsHeartbeatIntervalRef.current = setInterval(() => {
      if (wsProviderRef.current && wsProviderRef.current.readyState === WebSocket.OPEN) {
        try {
          // Send a simple ping message
          wsProviderRef.current.send(JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'net_version',
            params: []
          }));
          
          logger.debug('Sent WebSocket heartbeat');
        } catch (error) {
          logger.warn('Error sending WebSocket heartbeat:', error);
        }
      } else {
        // WebSocket is not connected, clear interval
        clearInterval(wsHeartbeatIntervalRef.current);
        wsHeartbeatIntervalRef.current = null;
      }
    }, 30000); // 30-second heartbeat
  }, []);
  
  // Clean up WebSocket resources
  const cleanupWebSocket = useCallback(() => {
    logger.info('Cleaning up WebSocket resources');
    
    // Clear timeouts and intervals
    if (wsConnectionTimeoutRef.current) {
      clearTimeout(wsConnectionTimeoutRef.current);
      wsConnectionTimeoutRef.current = null;
    }
    
    if (wsReconnectTimeoutRef.current) {
      clearTimeout(wsReconnectTimeoutRef.current);
      wsReconnectTimeoutRef.current = null;
    }
    
    if (wsHeartbeatIntervalRef.current) {
      clearInterval(wsHeartbeatIntervalRef.current);
      wsHeartbeatIntervalRef.current = null;
    }
    
    if (fallbackPollingIntervalRef.current) {
      clearInterval(fallbackPollingIntervalRef.current);
      fallbackPollingIntervalRef.current = null;
    }
    
    // Close WebSocket connection
    if (wsProviderRef.current && wsProviderRef.current.readyState === WebSocket.OPEN) {
      try {
        logger.info('Closing WebSocket connection');
        
        // Remove event handlers to prevent state updates during cleanup
        wsProviderRef.current.onclose = null;
        wsProviderRef.current.onerror = null;
        wsProviderRef.current.onopen = null;
        wsProviderRef.current.onmessage = null;
        
        // Close connection
        wsProviderRef.current.close();
      } catch (error) {
        logger.error('Error closing WebSocket:', error);
      }
    }
    
    // Reset provider and subscription refs
    wsProviderRef.current = null;
    wsSubscriptionIdRef.current = null;
    
    // Update connection state
    setWsConnected(false);
    setWsSubscriptionActive(false);
  }, []);
  
  // Subscribe to logs via eth_subscribe - define BEFORE initWebSocketConnection
  const subscribeToDRPCLogs = useCallback(() => {
    if (!wsProviderRef.current || wsProviderRef.current.readyState !== WebSocket.OPEN) {
      logger.info('Cannot subscribe to logs - WebSocket not connected');
      return;
    }
    
    if (!usdtAddress) {
      logger.info('Cannot subscribe to logs - Missing token address');
      return;
    }
    
    // Get the correct wallet address based on auth type
    const walletToWatch = authType === 'magic' 
      ? account
      : smartWalletAddress;
      
    if (!walletToWatch) {
      logger.info('Cannot subscribe to logs - Missing wallet address');
      return;
    }
    
    try {
      logger.info(`Setting up logs subscription for ${authType} wallet: ${walletToWatch}`);
      
      // Create a subscription request for logs related to our token contract and wallet
      // This specifically looks for token transfers to or from our wallet
      const subscriptionId = Date.now();
      wsSubscriptionIdRef.current = subscriptionId;
      
      // Create a filter for Transfer events involving our wallet
      const subscriptionRequest = {
        jsonrpc: '2.0',
        id: subscriptionId,
        method: 'eth_subscribe',
        params: [
          'logs',
          {
            address: usdtAddress,
            topics: [
              ethers.utils.id('Transfer(address,address,uint256)'), // Transfer event signature
              null, // From address (any)
              null  // To address (any)
            ]
          }
        ]
      };
      
      // Send the subscription request
      wsProviderRef.current.send(JSON.stringify(subscriptionRequest));
      
      logger.info('Sent logs subscription request');
    } catch (error) {
      logger.error('Error subscribing to logs:', error);
      setWsSubscriptionActive(false);
      
      // Set up fallback polling
      setupFallbackPolling();
    }
  }, [smartWalletAddress, usdtAddress, account, authType, setupFallbackPolling]);
  
  // Initialize WebSocket connection - AFTER subscribeToDRPCLogs is defined
  const initWebSocketConnection = useCallback(() => {
    // Skip if we already have a connection, no URL, or not connected
    if (wsProviderRef.current || !wsUrlRef.current || !isConnected) {
      return;
    }
    
    try {
      logger.info(`Initializing WebSocket connection to: ${wsUrlRef.current}`);
      
      // Create a raw WebSocket connection instead of ethers provider
      // This gives more direct control over the connection
      const ws = new WebSocket(wsUrlRef.current);
      
      // Store reference
      wsProviderRef.current = ws;
      
      // Set up connection timeout
      wsConnectionTimeoutRef.current = setTimeout(() => {
        if (!wsConnected) {
          logger.error('WebSocket connection timeout');
          cleanupWebSocket();
          
          // Try to reconnect after 5 seconds
          wsReconnectTimeoutRef.current = setTimeout(() => {
            if (isConnected) {
              initWebSocketConnection();
            }
          }, 5000);
        }
      }, 15000); // 15 second connection timeout
      
      // Set up handlers
      ws.onopen = () => {
        logger.info('WebSocket connection established');
        
        // Clear connection timeout
        if (wsConnectionTimeoutRef.current) {
          clearTimeout(wsConnectionTimeoutRef.current);
          wsConnectionTimeoutRef.current = null;
        }
        
        // Update connection state
        setWsConnected(true);
        
        // Setup heartbeat
        setupHeartbeat();
        
        // Subscribe to logs for the token contract (if wallet address is available)
        if ((authType === 'magic' && account) || (authType === 'wallet' && smartWalletAddress)) {
          logger.info(`WebSocket connected and wallet available (type: ${authType}) - setting up subscription`);
          subscribeToDRPCLogs();
        }
      };
      
      ws.onclose = (event) => {
        logger.warn(`WebSocket connection closed: ${event.code} - ${event.reason || 'No reason provided'}`);
        
        // Cleanup resources
        cleanupWebSocket();
        
        // Try to reconnect after a delay if still connected to wallet
        if (isConnected) {
          wsReconnectTimeoutRef.current = setTimeout(() => {
            initWebSocketConnection();
          }, 5000); // 5 second reconnection delay
        }
      };
      
      ws.onerror = (error) => {
        logger.error('WebSocket error:', error);
        // Will trigger onclose event, which handles reconnection
      };
      
      ws.onmessage = (event) => {
        try {
          // Parse the message data
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.id && wsSubscriptionIdRef.current === data.id) {
            // This is a response to our subscription request
            if (data.result) {
              logger.info(`Subscription confirmed, ID: ${data.result}`);
              wsSubscriptionIdRef.current = data.result;
              setWsSubscriptionActive(true);
            } else if (data.error) {
              logger.error(`Subscription error: ${data.error.message}`);
              setWsSubscriptionActive(false);
            }
          } else if (data.params && data.params.subscription === wsSubscriptionIdRef.current) {
            // This is a subscription notification
            logger.info('Received subscription notification');
            handleLogNotification(data.params.result);
          }
        } catch (error) {
          logger.error('Error processing WebSocket message:', error);
        }
      };
    } catch (error) {
      logger.error('Error initializing WebSocket connection:', error);
      cleanupWebSocket();
    }
  }, [
    isConnected, 
    cleanupWebSocket, 
    smartWalletAddress, 
    account, 
    authType, 
    setupHeartbeat, 
    subscribeToDRPCLogs, 
    handleLogNotification
  ]);
  
  // Get smart wallet address from the backend
  const getSmartWalletAddress = useCallback(async (userAddress) => {
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
  }, [authType]);
  
  // Deploy smart wallet if needed
  const deploySmartWalletIfNeeded = useCallback(async () => {
    try {
      setWalletLoading(true);
      setWalletError(null);
      
      // Skip for Magic users
      if (authType === 'magic' || !account) {
        setWalletLoading(false);
        return null;
      }
      
      // Check authentication status
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
  }, [account, authType, isConnected, openAuthModal, walletData, getSmartWalletAddress]);
  
  // Sign a transaction for a smart wallet
  const signSmartWalletTransaction = useCallback(async (targetAddress, callData, value = 0) => {
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
  }, [isConnected, authType, provider]);
  
  // Initialize WebSocket connection when auth state changes
  useEffect(() => {
    if (isConnected && account) {
      initWebSocketConnection();
    } else {
      cleanupWebSocket();
    }
    
    return () => {
      cleanupWebSocket();
    };
  }, [isConnected, account, initWebSocketConnection, cleanupWebSocket]);
  
  // Subscribe to logs when any wallet address becomes available
  useEffect(() => {
    if (wsConnected && isConnected) {
      // For Magic wallets, we use the account directly
      // For Web3 wallets, we wait for smartWalletAddress
      if ((authType === 'magic' && account) || (authType === 'wallet' && smartWalletAddress)) {
        logger.info(`WebSocket active and wallet available (type: ${authType}) - setting up subscription`);
        subscribeToDRPCLogs();
      }
    }
  }, [wsConnected, isConnected, smartWalletAddress, account, authType, subscribeToDRPCLogs]);
  
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
      
      // Clean up WebSocket
      cleanupWebSocket();
    };
    
    window.addEventListener('auth:logout', handleLogout);
    
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [cleanupWebSocket]);
  
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
      
      // Get initial USDT balance if WebSocket is not active
      if (!wsSubscriptionActive) {
        refreshUSDTBalance();
      }
    } else {
      // Reset wallet state when disconnected
      setSmartWalletAddress(null);
      setIsSmartWalletDeployed(false);
      setWalletData(null);
    }
  }, [isConnected, account, authType, getSmartWalletAddress, refreshUSDTBalance, wsSubscriptionActive]);
  
  // Set up fallback polling if WebSocket subscription fails
  useEffect(() => {
    // Check if we should be using fallback polling
    const shouldUseFallback = isConnected && 
      // For Magic users, check account. For Web3 users, check smart wallet
      ((authType === 'magic' && account) || (authType === 'wallet' && smartWalletAddress)) && 
      // WebSocket not working
      (!wsConnected || !wsSubscriptionActive);
      
    if (shouldUseFallback) {
      logger.info(`Setting up fallback polling for ${authType} wallet`);
      setupFallbackPolling();
    } else if (wsConnected && wsSubscriptionActive) {
      // Clear fallback polling if WebSocket is active
      if (fallbackPollingIntervalRef.current) {
        logger.info('WebSocket active, clearing fallback polling');
        clearInterval(fallbackPollingIntervalRef.current);
        fallbackPollingIntervalRef.current = null;
      }
    }
  }, [isConnected, smartWalletAddress, account, authType, wsConnected, wsSubscriptionActive, setupFallbackPolling]);
  
  return (
    <WalletContext.Provider
      value={{
        smartWalletAddress,
        usdtBalance,
        isSmartWalletDeployed,
        walletLoading,
        walletError,
        walletData, // Expose complete wallet data
        wsConnected, // Expose WebSocket connection status
        wsSubscriptionActive, // Expose subscription status
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