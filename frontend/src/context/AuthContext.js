// frontend/src/context/AuthContext.js
// --- VERSION: Refactored + Aggressive Logout + Centralized Magic Redirect Handling (setStatus fix) ---

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import createMagicInstance from '../config/magic';
import api from '../utils/api'; // Ensure api instance with authentication logic is imported
import logger from '../utils/logger';

// Create context
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // Authentication state
    const [isConnected, setIsConnected] = useState(false);
    const [account, setAccount] = useState(null);
    const [authType, setAuthType] = useState(null); // 'magic' or 'wallet'
    const [loading, setLoading] = useState(true); // Initial loading true
    const [error, setError] = useState(null); // For storing auth errors/info messages
    const [magic, setMagic] = useState(null); // Stores the Magic instance
    const [provider, setProvider] = useState(null); // Ethers provider
    const [signer, setSigner] = useState(null); // Ethers signer
    const [chainId, setChainId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // UI state
    const [showAuthModal, setShowAuthModal] = useState(false);

    // --- Simple Callbacks ---
    const openAuthModal = useCallback(() => setShowAuthModal(true), []);
    const closeAuthModal = useCallback(() => setShowAuthModal(false), []);

    // --- Event Handlers (Forward Declaration Needed for Logout Fallback) ---
    const handleChainChanged = useCallback((newChainId) => {
        logger.warn(`Network changed to: ${newChainId}. Reloading page for safety.`);
        // Full reload is often safest for dApps when network changes unexpectedly
        window.location.reload();
    }, []);

    // Forward declare handleAccountsChanged so logout can reference it
    let handleAccountsChanged = useCallback(async (accounts) => { /* Actual implementation below */ }, []); // Placeholder

    // --- Aggressive Logout Function ---
    // (Handles Magic/Wallet logout, clears storage, resets state)
    const logout = useCallback(async () => {
        logger.info("Logout initiated by AuthContext logout function (aggressive version).");
        try {
            // 1. Logout Magic User
            if (authType === 'magic' && magic?.user?.logout) {
                await magic.user.logout();
                logger.debug("Magic user logged out.");
            }

            // 2. Attempt wallet_revokePermissions (Optional, might not work)
            if (authType === 'wallet' && window.ethereum?.request) {
                try {
                    logger.debug("Attempting wallet_revokePermissions...");
                    await window.ethereum.request({
                        method: 'wallet_revokePermissions',
                        params: [{ eth_accounts: {} }]
                    });
                    logger.info("Wallet permissions revoked (attempted).");
                } catch (revokeError) {
                    logger.warn("Could not revoke wallet permissions (might not be supported by wallet):", revokeError.message);
                }
            }

            // 3. Remove Wallet Listeners Robustly
            if (window.ethereum) {
                if (window.ethereum.removeAllListeners) {
                    logger.debug("Removing all 'accountsChanged' and 'chainChanged' listeners via removeAllListeners.");
                    window.ethereum.removeAllListeners('accountsChanged');
                    window.ethereum.removeAllListeners('chainChanged');
                } else if (window.ethereum.removeListener) {
                    logger.debug("Falling back to removing specific listeners via removeListener.");
                    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                    window.ethereum.removeListener('chainChanged', handleChainChanged);
                }
            }

            // 4. Clear Core Authentication Artifacts via API Helper (removes JWT etc.)
            api.logout(); // Assumes this clears relevant localStorage like authToken
            logger.debug("Core auth artifacts cleared from localStorage via api.logout().");

            // 5. Explicitly Clear Other Potentially Relevant localStorage Items
            const extraKeysToClear = ['smartWalletAddress', 'walletAddress', 'isAuthenticated'];
            extraKeysToClear.forEach(key => {
                if (localStorage.getItem(key)) {
                    logger.debug(`Removing extra localStorage key: ${key}`);
                    localStorage.removeItem(key);
                }
            });

            // 6. Reset Internal React State
            setAccount(null); setSigner(null); setIsConnected(false);
            setAuthType(null); setProvider(null); setChainId(null);
            setMagic(null); setError(null); setIsAdmin(false); // Reset admin status on logout
            logger.debug("AuthContext internal state reset.");

            // 7. UI State Reset
            closeAuthModal();

            // 8. Dispatch Global Logout Event
            window.dispatchEvent(new CustomEvent('auth:logout'));
            logger.info("Aggressive logout process complete.");
            return true;
        } catch (error) {
            logger.error("Error during aggressive logout:", error.message);
            // Attempt minimal cleanup even on error
            try {
                api.logout();
                localStorage.removeItem('authToken'); // Ensure JWT is cleared
                localStorage.removeItem('smartWalletAddress');
                localStorage.removeItem('walletAddress');
                localStorage.removeItem('isAuthenticated');
                setAccount(null); setSigner(null); setIsConnected(false); setAuthType(null);
                setProvider(null); setChainId(null); setIsAdmin(false); setMagic(null);
            } catch (cleanupError) { logger.error("Logout cleanup error:", cleanupError); }
            setError("Error occurred during logout."); // Set general error state
            return false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authType, magic, closeAuthModal, handleAccountsChanged, handleChainChanged]); // Dependencies checked


    // --- Define Event Handlers (Actual Implementation) ---
    // (Handles wallet account changes or disconnections)
    handleAccountsChanged = useCallback(async (accounts) => {
        logger.debug("handleAccountsChanged Fired! New accounts:", accounts);
        if (accounts.length === 0 && authType === 'wallet') {
            // Wallet disconnected
            logger.warn("Wallet disconnected (no accounts found). Triggering logout.");
            await logout();
        } else if (account && accounts[0]?.toLowerCase() !== account.toLowerCase() && authType === 'wallet') {
            // Wallet account switched
            logger.warn(`Wallet account switched from ${account} to: ${accounts[0]}. Triggering logout.`);
            await logout();
            // Optional: Re-open auth modal after logout due to account switch
            // openAuthModal();
        } else {
            logger.debug(`handleAccountsChanged called but account is the same, non-wallet auth, or initial state: ${accounts[0]}`);
        }
    }, [account, logout, authType /*, openAuthModal */]);


    // --- Wallet Listener Setup ---
    // (Sets up listeners for account and network changes)
    const setupWalletListeners = useCallback(() => {
        if (window.ethereum) {
             // Remove existing listeners first to prevent duplicates
            if (window.ethereum.removeAllListeners) {
                 window.ethereum.removeAllListeners('accountsChanged');
                 window.ethereum.removeAllListeners('chainChanged');
             } else if (window.ethereum.removeListener) {
                 window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                 window.ethereum.removeListener('chainChanged', handleChainChanged);
             }
            // Add new listeners
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
            logger.debug("Wallet event listeners set up/reset.");
        }
    }, [handleAccountsChanged, handleChainChanged]);


    // --- Admin Status Check ---
    // (Checks backend if the currently connected account is an admin)
    const performAdminStatusCheck = useCallback(async (currentAccount) => {
        // Accept account as argument to avoid race conditions with state updates
        if (!currentAccount) {
            logger.debug("performAdminStatusCheck called without an account. Setting isAdmin to false.");
             if (isAdmin) setIsAdmin(false); // Clear admin status if no account
            return;
        }
         // Check if JWT exists, required for backend admin check
         const token = localStorage.getItem('authToken');
         if (!token) {
             logger.warn("performAdminStatusCheck: No auth token found, cannot check admin status.");
             if (isAdmin) setIsAdmin(false); // Clear admin if token disappears
             return;
         }

        logger.debug(`Checking admin status for account: ${currentAccount}`);
        try {
            // Assumes api instance includes Authorization header with JWT
            const response = await api.get(`/auth/is-address-admin/${currentAccount}`);
            if (response?.data?.success && response.data.data !== undefined) {
                const adminStatus = !!response.data.data.isAdmin;
                logger.info(`Setting admin status to: ${adminStatus}`);
                setIsAdmin(adminStatus);
            } else {
                logger.warn(`Failed to get admin status or invalid response structure. API error: ${response?.data?.error || 'Unknown error'}`);
                setIsAdmin(false);
            }
        } catch (error) {
            logger.error("Admin check API error:", error.message);
            // If the error is 401/403, it might mean the JWT is invalid - potentially logout?
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                 logger.error("Admin check failed due to authorization error. Logging out.");
                 await logout(); // Logout if admin check fails due to auth issue
             } else {
                 setIsAdmin(false); // Set false for other errors
             }
        }
    }, [isAdmin, logout]); // Added isAdmin and logout dependency


    // --- NEW: Set Magic User Session ---
    // Purpose: To be called AFTER successful external verification (in MagicRedirect)
    //          ONLY sets the context state based on provided details.
    const setMagicUserSession = useCallback(async ({ provider, signer, account: magicAccount, chainId: magicChainId, magicInstance }) => {
        logger.debug(`setMagicUserSession called for account: ${magicAccount}`);
        try {
            setLoading(true);
            setError(null); // Clear previous errors

            setProvider(provider);
            setSigner(signer);
            setAccount(magicAccount);
            setChainId(magicChainId);
            setMagic(magicInstance);
            setAuthType('magic');
            setIsConnected(true); // Set connected last

            // Perform admin check *after* setting the account state
            await performAdminStatusCheck(magicAccount);

            logger.info(`AuthContext state successfully set for Magic user: ${magicAccount}`);
            closeAuthModal(); // Close modal if it was open
            setLoading(false);
            return true; // Indicate success
        } catch (error) {
            logger.error("Error setting Magic user session in context:", error);
            setError(`Failed to set session: ${error.message}`);
            await logout(); // Logout on error setting session
            setLoading(false);
            return false; // Indicate failure
        }
    }, [logout, performAdminStatusCheck, closeAuthModal]); // Added dependencies


    // --- Initialize Magic User --- (REVISED PURPOSE)
    // Purpose: Initialize context state if an *existing* Magic session is found
    //          during the initial `checkExistingAuth` process.
    //          Does NOT handle token fetching or backend verification anymore.
    const initMagicUser = useCallback(async (magicInstance) => {
        logger.debug("initMagicUser: Initializing state from existing Magic session.");
        try {
            setLoading(true);
            setError(null);

            // Check if user is actually still logged in with this instance
            if (!(await magicInstance.user.isLoggedIn())) {
                 logger.warn("initMagicUser called, but user is no longer logged in with Magic.");
                 await logout(); // Clean up if logged out
                 setLoading(false);
                 return false;
             }

            const magicProvider = new ethers.providers.Web3Provider(magicInstance.rpcProvider);
            const userMetadata = await magicInstance.user.getInfo();
            const magicAddress = userMetadata.publicAddress;
            const magicSigner = magicProvider.getSigner();
            let currentChainId = null;
            try {
                const network = await magicProvider.getNetwork();
                currentChainId = network.chainId;
            } catch (err) {
                logger.error("Magic getNetwork error during init:", err.message);
            }

            if (!magicAddress) {
                 throw new Error("Could not get Magic public address during init.");
             }

            // JWT Check: Verify if a JWT exists from a previous login (MagicRedirect should have set it)
             const token = localStorage.getItem('authToken');
             if (!token) {
                 logger.warn("initMagicUser: Magic user is logged in, but no JWT found in storage. User might need to re-authenticate fully.");
                 // Decide whether to proceed or force re-auth. Proceeding might limit backend access.
                 // Consider logging out if a valid JWT is strictly required for all interactions.
                 // await logout();
                 // setLoading(false);
                 // return false;
             } else {
                 logger.debug("initMagicUser: Found existing JWT for logged-in Magic user.");
                 // Optional: Add a backend api.verifyToken() call here if you want extra assurance,
                 // but it might be redundant if subsequent API calls are protected.
             }


            // --- Set State ---
            setProvider(magicProvider);
            setAccount(magicAddress);
            setSigner(magicSigner);
            setAuthType('magic');
            setMagic(magicInstance); // Store the instance
            setChainId(currentChainId);
            setIsConnected(true); // Set connected last

            // Perform admin check *after* setting state
            await performAdminStatusCheck(magicAddress);

            logger.info("Magic user session restored and context initialized:", magicAddress);
            closeAuthModal();
            setLoading(false);
            return true;
        } catch (error) {
            logger.error("Magic init error (from existing session):", error.message);
            setError(`Magic initialization failed: ${error.message}`);
            await logout(); // Logout if init fails
            setLoading(false);
            return false;
        }
    }, [logout, performAdminStatusCheck, closeAuthModal]); // Added dependencies


    // --- Check Existing Authentication ---
    // (Checks for existing Magic or Wallet sessions on initial load)
    const checkExistingAuth = useCallback(async () => {
        // Avoid running if already connected or loading is already false (check completed)
         if (isConnected || !loading) {
             if (loading) setLoading(false); // Ensure loading is false if skipping
             return;
         }

        logger.info("Checking existing auth session...");
        setError(null);
        let sessionFound = false;

        try {
            // 1. Check Magic
            const magicInstance = createMagicInstance();
            if (magicInstance) {
                setMagic(magicInstance); // Store instance early
                if (await magicInstance.user.isLoggedIn()) {
                    logger.info("Found active Magic session. Initializing context state...");
                    sessionFound = await initMagicUser(magicInstance); // Use revised init
                    if (sessionFound) {
                         logger.debug("checkExistingAuth: Magic session restored.");
                         // Loading state is handled within initMagicUser
                         return; // Exit early if Magic session restored successfully
                     } else {
                         logger.warn("checkExistingAuth: initMagicUser failed for existing Magic session.");
                         // State should be cleared by logout within failed initMagicUser
                     }
                } else {
                    logger.debug("No active Magic session detected.");
                }
            } else {
                logger.warn("Magic instance could not be created during check.");
            }

            // 2. Check Wallet JWT (Only if Magic session wasn't found or failed to init)
            const storedAuthToken = localStorage.getItem('authToken');
            const storedAddress = localStorage.getItem('walletAddress');

            if (window.ethereum && storedAuthToken && storedAddress) {
                logger.info("Found Wallet JWT and address in storage. Verifying...");
                 // Check if MetaMask is connected to the stored address
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length === 0) {
                    logger.warn("checkExistingAuth: Wallet JWT found, but MetaMask is disconnected. Clearing session.");
                    await logout(); // Clear stored token if wallet isn't connected
                    setLoading(false); // Set loading false after logout attempt
                    return; // Stop checking
                }
                const currentAccount = accounts[0];
                if (currentAccount.toLowerCase() !== storedAddress.toLowerCase()) {
                    logger.warn(`checkExistingAuth: Wallet JWT found, but connected account (${currentAccount}) doesn't match stored address (${storedAddress}). Clearing session.`);
                    await logout(); // Clear token if accounts don't match
                    setLoading(false);
                    return; // Stop checking
                }

                // Try verifying the token with the backend
                try {
                    logger.debug("Verifying existing Wallet JWT with backend...");
                    await api.verifyToken(); // Assumes api.verifyToken() exists and throws on error/invalid
                    logger.info("Existing Wallet JWT verified successfully by backend.");

                    // If token is valid, set up the provider/signer state
                    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
                    const network = await web3Provider.getNetwork();
                    const currentSigner = web3Provider.getSigner();

                    setProvider(web3Provider);
                    setChainId(network.chainId);
                    setSigner(currentSigner);
                    setAccount(currentAccount);
                    setAuthType('wallet');
                    setupWalletListeners(); // Set up listeners for connected wallet
                    setIsConnected(true); // Set connected last

                    // Perform admin check *after* setting state
                    await performAdminStatusCheck(currentAccount);

                    sessionFound = true;
                    logger.info(`Wallet auth restored and verified for: ${currentAccount}`);

                } catch (verificationError) {
                    logger.warn("Existing Wallet JWT verification failed:", verificationError.message);
                    // Token exists but is invalid/expired, clear session
                    await logout();
                }
            } else {
                 logger.debug("No Wallet JWT or address found in storage.");
                 // Clean up potentially stale state if no valid session is identified
                 if (isConnected || account) {
                     logger.warn("checkExistingAuth: Cleaning up potentially stale auth state (no valid session found).");
                     await logout();
                 }
             }
        } catch (error) {
            logger.error("Error during existing auth check:", error.message);
            await logout(); // Attempt logout on major error during check
        } finally {
            // Ensure loading is set to false after check completes, unless already handled
            if (loading) { // Check if loading is still true before setting it
                 setLoading(false);
             }
            logger.debug("Finished checking existing auth.");
        }
    // Check dependencies carefully
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initMagicUser, logout, setupWalletListeners, performAdminStatusCheck, loading, isConnected, account]);


    // --- Connect Wallet Function ---
    // (Handles manual connection via MetaMask, including signing and backend auth)
    const connectWallet = useCallback(async () => {
        setError(null);
        if (!window.ethereum) {
             setError('MetaMask is not installed or not detected.');
             logger.error('MetaMask provider not found.');
             return false;
         }
        setLoading(true);
        let currentAccount = null;
        try {
            // Request accounts
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) { throw new Error("No accounts returned from MetaMask."); }
            currentAccount = accounts[0];
            logger.debug("Wallet accounts obtained:", accounts);

            // Set up provider and signer
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const network = await web3Provider.getNetwork();
            const currentSigner = web3Provider.getSigner();

            // Verify signer matches account
            const signerAddressCheck = await currentSigner.getAddress();
            if (signerAddressCheck.toLowerCase() !== currentAccount.toLowerCase()) {
                throw new Error(`Signer address (${signerAddressCheck}) does not match connected account (${currentAccount}).`);
            }
            logger.info("Signer address verified.");

            // Sign message for backend authentication
            const nonce = Date.now(); // Simple nonce
            const messageToSign = `Sign this message to authenticate your wallet ${currentAccount.substring(0, 6)}...${currentAccount.substring(currentAccount.length - 4)}. Nonce: ${nonce}`;
            logger.debug("Requesting signature...");
            const signature = await currentSigner.signMessage(messageToSign);
            logger.info("Signature obtained.");

            // Authenticate with backend using signature
            logger.debug("Calling api.authenticateWithWallet...");
            // This function should handle storing the JWT received from the backend via an interceptor or directly
            const isAuthenticated = await api.authenticateWithWallet(currentAccount, signature, messageToSign);

            if (isAuthenticated) {
                logger.info(`Backend authentication successful for: ${currentAccount}`);

                // --- Set State ---
                setProvider(web3Provider);
                setChainId(network.chainId);
                setSigner(currentSigner);
                setAccount(currentAccount);
                setAuthType('wallet');
                // Store address (JWT should be stored by api.authenticateWithWallet)
                localStorage.setItem('walletAddress', currentAccount.toLowerCase());
                localStorage.setItem('isAuthenticated', 'true'); // Mark as authenticated
                setupWalletListeners(); // Setup listeners for the connected wallet
                setIsConnected(true); // Set connected last

                // Perform admin check *after* setting state
                await performAdminStatusCheck(currentAccount);

                logger.info(`Wallet connected and authenticated: ${currentAccount}`);
                closeAuthModal();
                setLoading(false);
                return true;
            } else {
                // Backend authentication failed
                throw new Error("Backend authentication failed. Signature might be invalid or server unavailable.");
            }
        } catch (error) {
             logger.error("Wallet connection/authentication error:", error);
             // Provide more user-friendly error messages
             if (error.code === 4001) { // MetaMask User Rejected Request
                 setError("Connection request rejected. Please approve in MetaMask.");
             } else {
                 setError(`Connection failed: ${error.message}`);
             }
             await logout(); // Ensure cleanup on failure
             setLoading(false);
             return false;
        }
    }, [logout, setupWalletListeners, closeAuthModal, performAdminStatusCheck]); // Added performAdminStatusCheck


    // --- Login With Magic --- CORRECTED
    // (Initiates Magic Link or OAuth flow - does NOT complete it here)
    const loginWithMagic = useCallback(async (method, params) => {
        setLoading(true);
        setError(null);
        let magicInstance;
        try {
            magicInstance = createMagicInstance();
            if (!magicInstance) throw new Error('Magic instance could not be created.');
            setMagic(magicInstance); // Store the instance

            logger.info(`Attempting Magic login with method: ${method}`);

            if (method === 'email') {
                if (!params?.email) throw new Error("Email is required for Magic Link login.");
                // Initiate Magic Link flow - user completes in email
                await magicInstance.auth.loginWithMagicLink({ email: params.email });
                // Feedback should be shown in the UI component calling this function
                logger.info("Magic link initiated. User needs to check email.");
                setLoading(false); // Stop loading indicator for email flow
                return true; // Indicate initiation success

            } else if (method === 'google') {
                // Initiate Google OAuth flow - redirects away from app
                 const redirectURI = `${window.location.origin}/magic-callback`; // Ensure this matches dashboard
                await magicInstance.oauth.loginWithRedirect({
                    provider: 'google',
                    redirectURI: redirectURI
                 });
                // Browser will redirect, no further action here until callback
                // setLoading remains true until redirect happens
                return true; // Indicate initiation success
            }
             else {
                throw new Error('Unsupported Magic login method');
            }
        } catch (error) {
            logger.error("Magic login initiation error:", error.message);
            setError(`Magic login failed: ${error.message}`); // Use setError for actual errors
            setLoading(false); // Stop loading on error
            return false; // Indicate failure
        }
    // No dependencies needed here as it initiates external flow
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // --- Get Connection State --- (Helper function)
    // (Returns a snapshot of the current auth state)
    const getConnectionState = useCallback(() => {
        return { isConnected, account, authType, provider, signer, chainId, isAdmin, loading, error };
    }, [isConnected, account, authType, provider, signer, chainId, isAdmin, loading, error]);


    // --- Effects ---

    // Effect to check for existing session on initial load
    useEffect(() => {
        // The checkExistingAuth function now manages its own loading state check internally
        checkExistingAuth();
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty array ensures it runs only once


    // Effect to handle cleanup of wallet listeners on unmount
    useEffect(() => {
        // Return cleanup function
        return () => {
            if (window.ethereum) {
                logger.debug("AuthContext unmounting: Cleaning up wallet listeners.");
                 if (window.ethereum.removeAllListeners) {
                     window.ethereum.removeAllListeners('accountsChanged');
                     window.ethereum.removeAllListeners('chainChanged');
                 } else if (window.ethereum.removeListener) {
                     window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                     window.ethereum.removeListener('chainChanged', handleChainChanged);
                 }
            }
        };
    }, [handleAccountsChanged, handleChainChanged]); // Re-run cleanup setup if handlers change


    // --- Provider Value ---
    // (Object containing all state and functions to expose via context)
    const providerValue = {
        isConnected, account, authType, provider, signer, chainId, isAdmin,
        loading, error, // Expose error state for UI feedback
        showAuthModal,
        // Core Actions
        openAuthModal, closeAuthModal,
        connectWallet, loginWithMagic, logout,
        // State Accessor
        getConnectionState,
        // Internal-use (called by MagicRedirect) / Specific Initializers
        initMagicUser, // Keep if needed for session restoration logic
        setMagicUserSession, // NEW: For MagicRedirect to update state after verification
        // Utility/Check
        // performAdminStatusCheck, // Decide if this needs to be public
        setError, // Expose setError if UI needs to set info/error messages
    };


    return (
        <AuthContext.Provider value={providerValue}>
            {children}
        </AuthContext.Provider>
    );
};