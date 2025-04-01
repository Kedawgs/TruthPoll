// frontend/src/context/AuthContext.js
// --- VERSION: Refactored + Aggressive Logout ---

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import createMagicInstance from '../config/magic';
import api from '../utils/api'; // Ensure api instance with authenticateWithWallet is imported
import logger from '../utils/logger';

// Create context
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // Authentication state
    const [isConnected, setIsConnected] = useState(false);
    const [account, setAccount] = useState(null);
    const [authType, setAuthType] = useState(null); // 'magic' or 'wallet'
    const [loading, setLoading] = useState(true); // Initial loading true
    const [error, setError] = useState(null);
    const [magic, setMagic] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false); // isAdmin state

    // UI state
    const [showAuthModal, setShowAuthModal] = useState(false);

    // --- Simple Callbacks ---
    const openAuthModal = useCallback(() => setShowAuthModal(true), []);
    const closeAuthModal = useCallback(() => setShowAuthModal(false), []);

    // --- Event Handlers (Forward Declaration Needed for Logout Fallback) ---
    const handleChainChanged = useCallback((newChainId) => {
        logger.warn(`Network changed to: ${newChainId}. Reloading page.`);
        window.location.reload();
    }, []);

    // Forward declare handleAccountsChanged so logout can reference it
    let handleAccountsChanged = useCallback(async (accounts) => { /* Actual implementation below */ }, []); // Placeholder useCallback

    // --- Aggressive Logout Function ---
    const logout = useCallback(async () => {
        logger.info("Logout initiated by AuthContext logout function (aggressive version).");
        try {
            // 1. Logout Magic User
            if (authType === 'magic' && magic?.user?.logout) {
                await magic.user.logout();
                logger.debug("Magic user logged out.");
            }

            // 2. Attempt wallet_revokePermissions (Re-added "aggressive" step)
            // This is experimental and might not work on all wallets/browsers.
            // It attempts to make the wallet disconnect from the dapp.
            if (authType === 'wallet' && window.ethereum?.request) {
                try {
                    logger.debug("Attempting wallet_revokePermissions...");
                    await window.ethereum.request({
                        method: 'wallet_revokePermissions',
                        params: [{ eth_accounts: {} }]
                    });
                    logger.info("Wallet permissions revoked (attempted).");
                } catch (revokeError) {
                    // Log as warning because failure here is common and expected in many cases
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
                     // Use the most recently defined versions of handlers
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
            setAccount(null);
            setSigner(null);
            setIsConnected(false); // Triggers useEffect cleanup for admin status
            setAuthType(null);
            setProvider(null);
            setChainId(null);
            // setIsAdmin(false); // Let the useEffect handle this based on isConnected
            setMagic(null);
            setError(null);
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
                localStorage.removeItem('smartWalletAddress');
                localStorage.removeItem('walletAddress');
                localStorage.removeItem('isAuthenticated');
                setAccount(null); setSigner(null); setIsConnected(false); setAuthType(null);
                setProvider(null); setChainId(null); /* setIsAdmin(false); */ setMagic(null);
            } catch (cleanupError) { logger.error("Logout cleanup error:", cleanupError); }
            setError("Error occurred during logout.");
            return false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authType, magic, closeAuthModal, handleAccountsChanged, handleChainChanged]); // Dependencies checked

    // --- Define Event Handlers (Actual Implementation) ---
    // (Implementation remains the same as the previous refactored version)
    handleAccountsChanged = useCallback(async (accounts) => {
        logger.debug("handleAccountsChanged Fired! New accounts:", accounts);
        if (accounts.length === 0) {
            logger.warn("Wallet disconnected (no accounts found). Triggering logout.");
            await logout();
        } else if (account && accounts[0].toLowerCase() !== account.toLowerCase()) {
            logger.warn(`Wallet account switched from ${account} to: ${accounts[0]}. Triggering logout.`);
            await logout();
            openAuthModal();
        } else {
             logger.debug(`handleAccountsChanged called but account is the same or initial state: ${accounts[0]}`);
        }
    }, [account, logout, openAuthModal]);


    // --- Wallet Listener Setup ---
    // (Implementation remains the same as the previous refactored version)
    const setupWalletListeners = useCallback(() => {
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
    // (Implementation remains the same as the previous refactored version)
    const performAdminStatusCheck = useCallback(async () => {
        if (!isConnected || !account) {
            logger.warn("performAdminStatusCheck called but not connected or no account state. Skipping.");
            return;
        }
        logger.debug(`Checking admin status for account: ${account}`);
        try {
            const response = await api.get(`/auth/is-address-admin/${account}`);
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
            setIsAdmin(false);
        }
    }, [account, isConnected]);


    // --- Initialize Magic User ---
    // (Implementation remains the same as the previous refactored version)
     const initMagicUser = useCallback(async (magicInstance) => {
        try {
            setLoading(true);
            const magicProvider = new ethers.providers.Web3Provider(magicInstance.rpcProvider);
            const userMetadata = await magicInstance.user.getInfo();
            const magicAddress = userMetadata.publicAddress;
            if (!magicAddress) { throw new Error("Could not get Magic public address."); }

            setProvider(magicProvider); setAccount(magicAddress); setSigner(magicProvider.getSigner());
            setAuthType('magic');
            localStorage.setItem('walletAddress', magicAddress.toLowerCase());
            localStorage.setItem('isAuthenticated', 'true');
            try { const network = await magicProvider.getNetwork(); setChainId(network.chainId); }
            catch (err) { logger.error("Magic getNetwork error:", err.message); setChainId(null); }

            setIsConnected(true); // Set connected last
            logger.info("Magic user initialized and connected:", magicAddress);
            setLoading(false); closeAuthModal(); return true;
        } catch (error) {
            logger.error("Magic init error:", error.message); await logout();
            setError(`Magic initialization failed: ${error.message}`); setLoading(false); return false;
        }
    }, [logout, closeAuthModal]);


    // --- Check Existing Authentication ---
    // (Implementation remains the same as the previous refactored version, requires api.verifyToken)
    const checkExistingAuth = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            logger.info("Checking existing auth session...");
            // 1. Check Magic
            const magicInstance = createMagicInstance();
            if (magicInstance) {
                setMagic(magicInstance);
                if (await magicInstance.user.isLoggedIn()) {
                    logger.info("Found active Magic session. Initializing...");
                    await initMagicUser(magicInstance); return;
                } else { logger.debug("No active Magic session."); }
            } else { logger.debug("Magic instance could not be created."); }

            // 2. Check Wallet JWT
            const storedAuthToken = localStorage.getItem('authToken');
            const storedAddress = localStorage.getItem('walletAddress');
            if (window.ethereum && storedAuthToken && storedAddress) {
                logger.info("Found wallet JWT and address in storage.");
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length === 0) { logger.warn("MetaMask found JWT, but is disconnected. Clearing session."); await logout(); setLoading(false); return; }
                const currentAccount = accounts[0];
                if (currentAccount.toLowerCase() !== storedAddress.toLowerCase()) { logger.warn(`MetaMask account (${currentAccount}) doesn't match stored address (${storedAddress}). Clearing session.`); await logout(); setLoading(false); return; }

                try {
                    logger.debug("Verifying existing JWT with backend...");
                    await api.verifyToken(); // Assumes api.verifyToken() exists and throws on error
                    logger.info("Existing JWT verified successfully by backend.");

                    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
                    const network = await web3Provider.getNetwork();
                    const currentSigner = web3Provider.getSigner();

                    setProvider(web3Provider); setChainId(network.chainId); setSigner(currentSigner);
                    setAccount(currentAccount); setAuthType('wallet'); setupWalletListeners();
                    setIsConnected(true); // Set connected last
                    logger.info(`Wallet auth restored and verified for: ${currentAccount}`);
                } catch (verificationError) { logger.warn("Existing JWT verification failed:", verificationError.message); await logout(); }
            } else { logger.info("No existing Magic or Wallet session found."); if (isConnected || account || localStorage.getItem('authToken')) { logger.warn("Cleaning up potentially stale auth state."); await logout(); } }
        } catch (error) { logger.error("Error during existing auth check:", error.message); await logout(); }
        finally { setLoading(false); logger.debug("Finished checking existing auth."); }
    }, [initMagicUser, logout, setupWalletListeners, isConnected, account]); // Added isConnected/account


    // --- Connect Wallet Function ---
    // (Implementation remains the same as the previous refactored version)
    const connectWallet = useCallback(async () => {
        setError(null); if (!window.ethereum) { setError('MetaMask not installed.'); logger.error('MetaMask provider not found.'); return false; }
        setLoading(true); let currentAccount = null;
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) { throw new Error("No accounts returned from MetaMask."); }
            currentAccount = accounts[0]; logger.debug("Wallet accounts obtained:", accounts);
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const network = await web3Provider.getNetwork(); const currentSigner = web3Provider.getSigner();
            const signerAddressCheck = await currentSigner.getAddress();
            if (signerAddressCheck.toLowerCase() !== currentAccount.toLowerCase()) { throw new Error(`Signer address (${signerAddressCheck}) does not match connected account (${currentAccount}).`); }
            logger.info("Signer address verified.");
            const nonce = Date.now(); const messageToSign = `Sign this message to authenticate your wallet ${currentAccount.substring(0, 6)}...${currentAccount.substring(currentAccount.length - 4)} with TruthPoll. Nonce: ${nonce}`;
            logger.debug("Requesting signature..."); const signature = await currentSigner.signMessage(messageToSign); logger.info("Signature obtained.");
            logger.debug("Calling api.authenticateWithWallet...");
            const isAuthenticated = await api.authenticateWithWallet(currentAccount, signature, messageToSign);
            if (isAuthenticated) {
                logger.info(`Backend authentication successful for: ${currentAccount}`);
                setProvider(web3Provider); setChainId(network.chainId); setSigner(currentSigner);
                setAccount(currentAccount); setAuthType('wallet');
                localStorage.setItem('walletAddress', currentAccount.toLowerCase());
                localStorage.setItem('isAuthenticated', 'true');
                setupWalletListeners();
                setIsConnected(true); // Set connected last
                logger.info(`Wallet connected and authenticated: ${currentAccount}`);
                closeAuthModal(); setLoading(false); return true;
            } else { throw new Error("Backend authentication failed."); }
        } catch (error) {
            logger.error("Wallet connection/authentication error:", error);
            setError(`Connection failed: ${error.message}`); await logout(); setLoading(false); return false;
        }
    }, [logout, setupWalletListeners, closeAuthModal]);


    // --- Login With Magic ---
    // (Implementation remains the same as the previous refactored version)
    const loginWithMagic = useCallback(async (method, params) => {
        setLoading(true); setError(null);
        try {
            const magicInstance = createMagicInstance(); if (!magicInstance) throw new Error('Magic instance could not be created.'); setMagic(magicInstance);
            logger.info(`Attempting Magic login with method: ${method}`);
            if (method === 'email') { if (!params?.email) throw new Error("Email is required for Magic Link login."); await magicInstance.auth.loginWithMagicLink({ email: params.email }); setError("Magic link sent! Please check your email."); return false; }
            else if (method === 'google') { await magicInstance.oauth.loginWithRedirect({ provider: 'google', redirectURI: `${window.location.origin}/magic-callback` }); return false; }
            else { throw new Error('Unsupported Magic login method'); }
        } catch (error) { logger.error("Magic login initiation error:", error.message); setError(`Magic login failed: ${error.message}`); setLoading(false); return false; }
    }, []);


    // --- Get Connection State --- (Helper function)
    // (Implementation remains the same)
    const getConnectionState = useCallback(() => {
        return { isConnected, account, authType, provider, signer, chainId, isAdmin, loading, error };
    }, [isConnected, account, authType, provider, signer, chainId, isAdmin, loading, error]);


    // --- Effects ---
    // (Implementations remain the same as the previous refactored version)
    useEffect(() => { if (!isConnected) { checkExistingAuth(); } }, [isConnected, checkExistingAuth]); // checkExistingAuth added
    useEffect(() => {
        if (isConnected && account) { logger.debug("Connection established, performing admin status check..."); performAdminStatusCheck(); }
        else { if (isAdmin) { logger.debug("User disconnected or account changed, setting isAdmin to false."); setIsAdmin(false); } }
    }, [isConnected, account, isAdmin, performAdminStatusCheck]); // isAdmin/performAdmin... added

    // --- Provider Value ---
    // Ensure all required functions/state are included
    const providerValue = {
        isConnected, account, authType, provider, signer, chainId, isAdmin,
        loading, error, showAuthModal,
        openAuthModal, closeAuthModal, connectWallet, loginWithMagic, logout, getConnectionState,
        initMagicUser, // Make sure this is provided if used by callback page
    };


    return (
        <AuthContext.Provider value={providerValue}>
            {children}
        </AuthContext.Provider>
    );
};