// frontend/src/context/AuthContext.js
// --- VERSION: Refactored + Aggressive Logout (Enhanced Magic) + Google Prompt Param (Assumed SDK Support) ---

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

    // --- Aggressive Logout Function (Enhanced for Magic) ---
    const logout = useCallback(async () => {
        logger.info("Logout initiated by AuthContext logout function (aggressive version).");
        // *** [The enhanced logout function code as provided previously goes here] ***
        // --- (Including Magic logout, wallet revoke, listener removal, ---
        // --- localStorage clear, state reset, and conditional page reload) ---
        try {
            // 1. Logout Magic User - ENHANCED
            if (authType === 'magic' && magic) {
                try {
                    logger.debug("Starting aggressive Magic logout process...");
                    if (magic.user && magic.user.logout) {
                        await magic.user.logout();
                        logger.debug("Magic user.logout() completed.");
                    }
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.toLowerCase().includes('magic')) {
                                logger.debug(`Removing Magic localStorage key: ${key}`);
                                localStorage.removeItem(key);
                            }
                        }
                        if (magic.rpcProvider && magic.rpcProvider.disconnect) {
                            await magic.rpcProvider.disconnect();
                            logger.debug("Magic RPC provider disconnected.");
                        }
                        const magicCookies = document.cookie.split(';')
                            .filter(cookie => cookie.trim().toLowerCase().startsWith('magic'));
                        magicCookies.forEach(cookie => {
                            const cookieName = cookie.split('=')[0].trim();
                            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
                            logger.debug(`Expired cookie: ${cookieName}`);
                        });
                        logger.debug("Magic additional cleanup complete.");
                    } catch (magicCleanupError) {
                        logger.warn("Error during aggressive Magic cleanup:", magicCleanupError);
                    }
                } catch (magicLogoutError) {
                    logger.error("Magic primary logout error:", magicLogoutError);
                }
            }

            // 2. Attempt wallet_revokePermissions
            if (authType === 'wallet' && window.ethereum?.request) {
                try {
                    logger.debug("Attempting wallet_revokePermissions...");
                    await window.ethereum.request({
                        method: 'wallet_revokePermissions',
                        params: [{ eth_accounts: {} }]
                    });
                    logger.info("Wallet permissions revoked (attempted).");
                } catch (revokeError) {
                    logger.warn("Could not revoke wallet permissions:", revokeError.message);
                }
            }

            // 3. Remove Wallet Listeners
            if (window.ethereum) {
                if (window.ethereum.removeAllListeners) {
                    window.ethereum.removeAllListeners('accountsChanged');
                    window.ethereum.removeAllListeners('chainChanged');
                } else if (window.ethereum.removeListener) {
                    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                    window.ethereum.removeListener('chainChanged', handleChainChanged);
                }
            }

            // 4. Clear Core Auth Artifacts
            api.logout();
            logger.debug("Core auth artifacts cleared via api.logout().");

            // 5. Clear Extra localStorage
            const extraKeysToClear = ['smartWalletAddress', 'walletAddress', 'isAuthenticated', 'userProfile', 'magicOAuthToken', 'magicIdToken'];
            extraKeysToClear.forEach(key => {
                if (localStorage.getItem(key)) {
                    logger.debug(`Removing extra localStorage key: ${key}`);
                    localStorage.removeItem(key);
                }
            });

            // 6. Reset React State
            setAccount(null); setSigner(null); setIsConnected(false);
            setAuthType(null); setProvider(null); setChainId(null);
            setMagic(null); setError(null); setIsAdmin(false);
            logger.debug("AuthContext internal state reset.");

            // 7. UI State Reset
            closeAuthModal();

            // 8. Force Reload for Magic
            const wasMagic = authType === 'magic'; // Capture before state reset
            if (wasMagic) {
                logger.info("Magic user detected - forcing page reload for complete cleanup");
                setTimeout(() => { window.location.reload(); }, 100);
                return true; // Early return due to reload
            }

            // 9. Dispatch Global Logout Event
            window.dispatchEvent(new CustomEvent('auth:logout'));
            logger.info("Aggressive logout process complete.");
            return true;
        } catch (error) {
            logger.error("Error during aggressive logout:", error.message);
            try {
                api.logout();
                localStorage.removeItem('authToken'); localStorage.removeItem('smartWalletAddress');
                localStorage.removeItem('walletAddress'); localStorage.removeItem('isAuthenticated');
                setAccount(null); setSigner(null); setIsConnected(false); setAuthType(null);
                setProvider(null); setChainId(null); setIsAdmin(false); setMagic(null);
            } catch (cleanupError) { logger.error("Logout cleanup error:", cleanupError); }
            setError("Error occurred during logout.");
            return false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authType, magic, closeAuthModal, handleAccountsChanged, handleChainChanged]);


    // --- Define Event Handlers (Actual Implementation) ---
    handleAccountsChanged = useCallback(async (accounts) => {
        // *** [handleAccountsChanged code as provided previously goes here] ***
        logger.debug("handleAccountsChanged Fired! New accounts:", accounts);
        if (accounts.length === 0 && authType === 'wallet') {
            logger.warn("Wallet disconnected. Triggering logout.");
            await logout();
        } else if (account && accounts[0]?.toLowerCase() !== account.toLowerCase() && authType === 'wallet') {
            logger.warn(`Wallet account switched. Triggering logout.`);
            await logout();
        } else {
             logger.debug(`handleAccountsChanged called but no action needed.`);
        }
    }, [account, logout, authType]);


    // --- Wallet Listener Setup ---
    const setupWalletListeners = useCallback(() => {
        // *** [setupWalletListeners code as provided previously goes here] ***
        if (window.ethereum) {
             if (window.ethereum.removeAllListeners) {
                 window.ethereum.removeAllListeners('accountsChanged');
                 window.ethereum.removeAllListeners('chainChanged');
             } else if (window.ethereum.removeListener) {
                 window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                 window.ethereum.removeListener('chainChanged', handleChainChanged);
             }
             window.ethereum.on('accountsChanged', handleAccountsChanged);
             window.ethereum.on('chainChanged', handleChainChanged);
             logger.debug("Wallet event listeners set up/reset.");
         }
    }, [handleAccountsChanged, handleChainChanged]);


    // --- Admin Status Check ---
    const performAdminStatusCheck = useCallback(async (currentAccount) => {
        // *** [performAdminStatusCheck code as provided previously goes here] ***
         if (!currentAccount) {
             if (isAdmin) setIsAdmin(false);
             return;
         }
         const token = localStorage.getItem('authToken');
         if (!token) {
             logger.warn("performAdminStatusCheck: No auth token found.");
             if (isAdmin) setIsAdmin(false);
             return;
         }
         logger.debug(`Checking admin status for account: ${currentAccount}`);
         try {
             const response = await api.get(`/auth/is-address-admin/${currentAccount}`);
             const adminStatus = !!response?.data?.data?.isAdmin;
             logger.info(`Setting admin status to: ${adminStatus}`);
             setIsAdmin(adminStatus);
         } catch (error) {
             logger.error("Admin check API error:", error.message);
             if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                 logger.error("Admin check failed due to auth error. Logging out.");
                 await logout();
             } else {
                 setIsAdmin(false);
             }
         }
    }, [isAdmin, logout]);


    // --- NEW: Set Magic User Session ---
    const setMagicUserSession = useCallback(async ({ provider, signer, account: magicAccount, chainId: magicChainId, magicInstance }) => {
        // *** [setMagicUserSession code as provided previously goes here] ***
        logger.debug(`setMagicUserSession called for account: ${magicAccount}`);
        try {
            setLoading(true); setError(null);
            setProvider(provider); setSigner(signer); setAccount(magicAccount);
            setChainId(magicChainId); setMagic(magicInstance); setAuthType('magic');
            setIsConnected(true);
            await performAdminStatusCheck(magicAccount);
            logger.info(`AuthContext state successfully set for Magic user: ${magicAccount}`);
            closeAuthModal(); setLoading(false);
            return true;
        } catch (error) {
            logger.error("Error setting Magic user session:", error);
            setError(`Failed to set session: ${error.message}`);
            await logout(); setLoading(false);
            return false;
        }
    }, [logout, performAdminStatusCheck, closeAuthModal]);


    // --- Initialize Magic User ---
    const initMagicUser = useCallback(async (magicInstance) => {
        // *** [initMagicUser code as provided previously goes here] ***
        logger.debug("initMagicUser: Initializing state from existing Magic session.");
        try {
            setLoading(true); setError(null);
            if (!(await magicInstance.user.isLoggedIn())) {
                logger.warn("initMagicUser: User no longer logged in with Magic.");
                await logout(); setLoading(false); return false;
            }
            const magicProvider = new ethers.providers.Web3Provider(magicInstance.rpcProvider);
            const userMetadata = await magicInstance.user.getInfo();
            const magicAddress = userMetadata.publicAddress;
            const magicSigner = magicProvider.getSigner();
            let currentChainId = null;
            try {
                currentChainId = (await magicProvider.getNetwork()).chainId;
            } catch (err) { logger.error("Magic getNetwork error during init:", err.message); }
            if (!magicAddress) throw new Error("Could not get Magic public address.");
            const token = localStorage.getItem('authToken');
            if (!token) logger.warn("initMagicUser: Magic user logged in, but no JWT found.");
            else logger.debug("initMagicUser: Found existing JWT.");
            setProvider(magicProvider); setAccount(magicAddress); setSigner(magicSigner);
            setAuthType('magic'); setMagic(magicInstance); setChainId(currentChainId);
            setIsConnected(true);
            await performAdminStatusCheck(magicAddress);
            logger.info("Magic user session restored:", magicAddress);
            closeAuthModal(); setLoading(false);
            return true;
        } catch (error) {
            logger.error("Magic init error:", error.message);
            setError(`Magic initialization failed: ${error.message}`);
            await logout(); setLoading(false);
            return false;
        }
    }, [logout, performAdminStatusCheck, closeAuthModal]);


    // --- Check Existing Authentication ---
    const checkExistingAuth = useCallback(async () => {
        // *** [checkExistingAuth code as provided previously goes here] ***
        if (isConnected || !loading) {
             if (loading) setLoading(false);
             return;
        }
        logger.info("Checking existing auth session..."); setError(null);
        let sessionFound = false;
        try {
            const magicInstance = createMagicInstance();
            if (magicInstance) {
                setMagic(magicInstance);
                if (await magicInstance.user.isLoggedIn()) {
                    logger.info("Found active Magic session.");
                    sessionFound = await initMagicUser(magicInstance);
                    if (sessionFound) return; // Exit early
                    else logger.warn("checkExistingAuth: initMagicUser failed.");
                } else logger.debug("No active Magic session.");
            } else logger.warn("Magic instance creation failed.");

            const storedAuthToken = localStorage.getItem('authToken');
            const storedAddress = localStorage.getItem('walletAddress');
            if (window.ethereum && storedAuthToken && storedAddress) {
                logger.info("Found Wallet JWT and address. Verifying...");
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length === 0) {
                    logger.warn("Wallet JWT found, but MetaMask disconnected. Clearing.");
                    await logout(); setLoading(false); return;
                }
                const currentAccount = accounts[0];
                if (currentAccount.toLowerCase() !== storedAddress.toLowerCase()) {
                    logger.warn("Wallet JWT found, but account mismatch. Clearing.");
                    await logout(); setLoading(false); return;
                }
                try {
                    await api.verifyToken(); // Assumes this throws on invalid/expired
                    logger.info("Existing Wallet JWT verified.");
                    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
                    const network = await web3Provider.getNetwork();
                    const currentSigner = web3Provider.getSigner();
                    setProvider(web3Provider); setChainId(network.chainId); setSigner(currentSigner);
                    setAccount(currentAccount); setAuthType('wallet'); setupWalletListeners();
                    setIsConnected(true);
                    await performAdminStatusCheck(currentAccount);
                    sessionFound = true;
                    logger.info(`Wallet auth restored: ${currentAccount}`);
                } catch (verificationError) {
                    logger.warn("Wallet JWT verification failed:", verificationError.message);
                    await logout();
                }
            } else logger.debug("No Wallet JWT or address found.");

            if (!sessionFound && (isConnected || account)) {
                 logger.warn("checkExistingAuth: Cleaning up stale auth state.");
                 await logout();
            }

        } catch (error) {
            logger.error("Error during existing auth check:", error.message);
            await logout();
        } finally {
            if (loading) setLoading(false);
            logger.debug("Finished checking existing auth.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initMagicUser, logout, setupWalletListeners, performAdminStatusCheck, loading, isConnected, account]);


    // --- Connect Wallet Function ---
    const connectWallet = useCallback(async () => {
        // *** [connectWallet code as provided previously goes here] ***
        setError(null);
        if (!window.ethereum) {
            setError('MetaMask not detected.'); logger.error('MetaMask not found.'); return false;
        }
        setLoading(true);
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) throw new Error("No accounts returned.");
            const currentAccount = accounts[0];
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const network = await web3Provider.getNetwork();
            const currentSigner = web3Provider.getSigner();
            if ((await currentSigner.getAddress()).toLowerCase() !== currentAccount.toLowerCase()) {
                throw new Error("Signer address mismatch.");
            }
            const nonce = Date.now();
            const messageToSign = `Authenticate ${currentAccount.substring(0, 6)}...${currentAccount.substring(currentAccount.length - 4)}. Nonce: ${nonce}`;
            const signature = await currentSigner.signMessage(messageToSign);
            const isAuthenticated = await api.authenticateWithWallet(currentAccount, signature, messageToSign);
            if (isAuthenticated) {
                setProvider(web3Provider); setChainId(network.chainId); setSigner(currentSigner);
                setAccount(currentAccount); setAuthType('wallet');
                localStorage.setItem('walletAddress', currentAccount.toLowerCase());
                localStorage.setItem('isAuthenticated', 'true');
                setupWalletListeners(); setIsConnected(true);
                await performAdminStatusCheck(currentAccount);
                logger.info(`Wallet connected: ${currentAccount}`);
                closeAuthModal(); setLoading(false);
                return true;
            } else {
                throw new Error("Backend authentication failed.");
            }
        } catch (error) {
            logger.error("Wallet connection error:", error);
            setError(error.code === 4001 ? "Request rejected." : `Connection failed: ${error.message}`);
            await logout(); setLoading(false);
            return false;
        }
    }, [logout, setupWalletListeners, closeAuthModal, performAdminStatusCheck]);


    // --- Login With Magic --- MODIFIED ---
    // (Initiates Magic Link or OAuth flow - attempts to force Google account selection)
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
                await magicInstance.auth.loginWithMagicLink({ email: params.email });
                logger.info("Magic link initiated. Check email.");
                setLoading(false); // Stop loading for email flow (user action required)
                // Consider setting an informational message via setError here for the UI
                // setError("Magic link sent! Please check your email.");
                return true; // Indicate initiation success

            } else if (method === 'google') {
                const redirectURI = `${window.location.origin}/magic-callback`; // Ensure this matches Magic dashboard

                // --- MODIFICATION START ---
                // Prepare options for loginWithRedirect
                const magicOAuthOptions = {
                    provider: 'google',
                    redirectURI: redirectURI
                };

                // ** IMPORTANT: Verify 'additionalParams' is the correct option key in Magic SDK Documentation **
                // This attempts to force Google to always show the account selection screen.
                magicOAuthOptions.additionalParams = {
                    prompt: 'select_account'
                    // access_type: 'offline' // Generally not needed for this purpose with Magic
                };
                logger.debug("Initiating Google OAuth with prompt=select_account parameter (assuming SDK support).");

                // Initiate Google OAuth flow - redirects away from app
                await magicInstance.oauth.loginWithRedirect(magicOAuthOptions);
                // --- MODIFICATION END ---

                // Browser will redirect, no further action here until callback
                // setLoading remains true until redirect or failure
                return true; // Indicate initiation success (redirection expected)

            } else {
                throw new Error('Unsupported Magic login method');
            }
        } catch (error) {
            logger.error("Magic login initiation error:", error.message);
            setError(`Magic login failed: ${error.message}`);
            setLoading(false); // Stop loading on error
            return false; // Indicate failure
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // No dependencies needed here as it initiates external flow


    // --- Get Connection State ---
    const getConnectionState = useCallback(() => {
        return { isConnected, account, authType, provider, signer, chainId, isAdmin, loading, error };
    }, [isConnected, account, authType, provider, signer, chainId, isAdmin, loading, error]);


    // --- Effects ---

    // Effect to check for existing session on initial load
    useEffect(() => {
        checkExistingAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Runs once on mount


    // Effect to handle cleanup of wallet listeners on unmount
    useEffect(() => {
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
    }, [handleAccountsChanged, handleChainChanged]);


    // --- Provider Value ---
    const providerValue = {
        isConnected, account, authType, provider, signer, chainId, isAdmin,
        loading, error,
        showAuthModal,
        openAuthModal, closeAuthModal,
        connectWallet, loginWithMagic, logout,
        getConnectionState,
        initMagicUser,
        setMagicUserSession,
        setError,
    };


    return (
        <AuthContext.Provider value={providerValue}>
            {children}
        </AuthContext.Provider>
    );
};