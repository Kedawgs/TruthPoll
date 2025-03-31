// frontend/src/context/AuthContext.js
// --- VERSION: Reverted complex useCallback, kept reordering & enhanced logout ---

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
    const [isAdmin, setIsAdmin] = useState(false);

    // UI state
    const [showAuthModal, setShowAuthModal] = useState(false);

    // --- Define Functions ---
    // Define simple callbacks first
    const openAuthModal = useCallback(() => setShowAuthModal(true), []);
    const closeAuthModal = useCallback(() => setShowAuthModal(false), []);

    // Define handlers (will be recreated on render, usually fine unless passed deep down)
    // We need them defined before logout uses them in listener removal fallback
    const handleChainChanged = (newChainId) => {
        logger.warn(`Network changed to: ${newChainId}. Reloading page.`);
        window.location.reload();
    };

    // Forward declare handleAccountsChanged so logout can reference it for listener removal fallback
    // The actual implementation comes after logout
    let handleAccountsChanged = async (accounts) => {};


    // --- Enhanced Logout Function (Defined Before Dependencies) ---
    const logout = async () => {
        logger.info("Logout initiated by AuthContext logout function (enhanced version).");
        try {
            // 1. Logout Magic User if applicable
            if (authType === 'magic' && magic?.user) {
                await magic.user.logout();
                logger.debug("Magic user logged out.");
            }

            // 2. Attempt to revoke wallet permissions
            if (authType === 'wallet' && window.ethereum?.request) {
                 try {
                     logger.debug("Attempting wallet_revokePermissions...");
                     await window.ethereum.request({
                         method: 'wallet_revokePermissions',
                         params: [{ eth_accounts: {} }]
                     });
                     logger.info("Wallet permissions revoked (attempted).");
                 } catch (revokeError) {
                     logger.info("Could not revoke wallet permissions:", revokeError.message);
                 }
            }

            // 3. Remove Wallet Event Listeners Robustly
            if (window.ethereum) {
                if (window.ethereum.removeAllListeners) {
                    logger.debug("Removing all 'accountsChanged' and 'chainChanged' listeners.");
                    window.ethereum.removeAllListeners('accountsChanged');
                    window.ethereum.removeAllListeners('chainChanged');
                } else {
                    // Fallback if removeAllListeners is not available
                    logger.debug("Falling back to removing specific listeners.");
                    window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged); // Use forward declared reference
                    window.ethereum.removeListener?.('chainChanged', handleChainChanged);
                }
            }

            // 4. Clear Core Authentication Artifacts via API Helper
            api.logout(); // Clears authToken, isAuthenticated, walletAddress, walletSignature
            logger.debug("Core auth artifacts cleared from localStorage via api.logout().");

            // 5. Explicitly Clear Other Potentially Relevant localStorage Items
            const extraKeysToClear = [ 'smartWalletAddress' ];
            extraKeysToClear.forEach(key => {
                 if (localStorage.getItem(key)) {
                     logger.debug(`Removing extra localStorage key: ${key}`);
                     localStorage.removeItem(key);
                 }
            });

            // 6. Reset Internal React State
            setAccount(null); setSigner(null); setIsConnected(false); setAuthType(null);
            setProvider(null); setChainId(null); setIsAdmin(false); setMagic(null);
            setError(null);
            logger.debug("AuthContext internal state reset.");

            // 7. UI State Reset
            closeAuthModal(); // Use simple callback

            // 8. Dispatch Global Logout Event AFTER clearing state
            window.dispatchEvent(new CustomEvent('auth:logout'));
            logger.info("Enhanced logout process complete.");
            return true;
        } catch (error) {
            logger.error("Error during enhanced logout:", error.message);
            try { // Attempt cleanup even on error
                 api.logout(); localStorage.removeItem('smartWalletAddress');
                 setAccount(null); setSigner(null); setIsConnected(false); setAuthType(null);
                 setProvider(null); setChainId(null); setIsAdmin(false); setMagic(null);
            } catch (cleanupError) { logger.error("Logout cleanup error:", cleanupError); }
            setError("Error occurred during logout.");
            return false;
        }
    };

    // --- Define Event Handlers (Implement handleAccountsChanged) ---
    // Define actual implementation after logout is defined
    handleAccountsChanged = async (accounts) => {
        logger.debug("handleAccountsChanged Fired! New accounts:", accounts);
        if (accounts.length === 0) {
            logger.warn("Wallet disconnected via accountsChanged.");
            await logout();
        } else {
            logger.info(`Account switched to: ${accounts[0]}. Triggering logout.`);
            await logout();
            openAuthModal(); // Prompt re-login after state is cleared
        }
    };


    // --- Define Other Functions ---
    const setupWalletListeners = () => {
        if (window.ethereum) {
            // Use removeAllListeners before adding to ensure clean setup (optional but safer)
             if (window.ethereum.removeAllListeners) {
                 window.ethereum.removeAllListeners('accountsChanged');
                 window.ethereum.removeAllListeners('chainChanged');
             }
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
            logger.debug("Wallet event listeners set up/reset.");
        }
    };

    const checkAdminStatus = async () => {
        const currentAccount = account || localStorage.getItem('walletAddress');
        if (!isConnected || !currentAccount) { setIsAdmin(false); return; }
        logger.debug(`Checking admin status for account: ${currentAccount}`);
        try {
            const response = await api.get(`/auth/is-address-admin/${currentAccount}`);
            if (response.data.success) { setIsAdmin(response.data.data.isAdmin); logger.info(`Admin status: ${response.data.data.isAdmin}`); }
            else { setIsAdmin(false); logger.warn(`Failed get admin status: ${response.data.error}`); }
        } catch (error) { logger.error("Admin check error:", error.message); setIsAdmin(false); }
    };

    const initMagicUser = async (magicInstance) => {
        try {
            const magicProvider = new ethers.providers.Web3Provider(magicInstance.rpcProvider);
            const userMetadata = await magicInstance.user.getInfo(); const magicAddress = userMetadata.publicAddress;
            setProvider(magicProvider); setAccount(magicAddress); setSigner(magicProvider.getSigner());
            setIsConnected(true); setAuthType('magic');
            localStorage.setItem('walletAddress', magicAddress.toLowerCase()); localStorage.setItem('isAuthenticated', 'true');
            try { const network = await magicProvider.getNetwork(); setChainId(network.chainId); } catch (err) { logger.error("Magic network error:", err.message); }
            logger.info("Magic user initialized:", magicAddress);
            return { account: magicAddress, provider: magicProvider, signer: magicProvider.getSigner() };
        } catch (error) { logger.error("Magic init error:", error.message); throw error; }
    };

    const checkExistingAuth = async () => {
         setLoading(true); setError(null);
         try {
             logger.info("Checking existing auth...");
             // Magic Check...
             const magicInstance = createMagicInstance();
             if (magicInstance) {
                 setMagic(magicInstance);
                 if (await magicInstance.user.isLoggedIn()) {
                     logger.info("Found active Magic session"); await initMagicUser(magicInstance);
                     setLoading(false); return;
                 } else { logger.debug("No active Magic session."); }
             } else { logger.debug("No Magic instance."); }
             // Wallet JWT Check...
             const storedAuthToken = localStorage.getItem('authToken'); const storedAddress = localStorage.getItem('walletAddress');
             if (window.ethereum && storedAuthToken && storedAddress) {
                 logger.info("Found wallet JWT.");
                  const web3Provider = new ethers.providers.Web3Provider(window.ethereum); setProvider(web3Provider);
                  const network = await web3Provider.getNetwork(); setChainId(network.chainId);
                  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                  if (accounts.length > 0 && accounts[0].toLowerCase() === storedAddress.toLowerCase()) {
                     logger.info(`Wallet connected & matches JWT: ${accounts[0]}`);
                     setAccount(accounts[0]); setSigner(web3Provider.getSigner()); setIsConnected(true);
                     setAuthType('wallet'); setupWalletListeners(); logger.info("Wallet auth restored.");
                  } else { logger.warn(`Wallet mismatch/disconnected. Clearing auth.`); await logout(); }
             } else { logger.info("No existing session found."); if (isConnected || account || localStorage.getItem('authToken')) { await logout(); } }
         } catch (error) { logger.error("Existing auth check error:", error.message); await logout(); }
         finally { setLoading(false); }
     };

     const connectWallet = async () => {
        setError(null);
        if (!window.ethereum) { setError('MetaMask not installed.'); logger.error('No provider.'); return false; }
        setLoading(true);
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            logger.debug("connectWallet accounts:", accounts);
            if (accounts?.[0]) {
                const currentAccount = accounts[0];
                let web3Provider = new ethers.providers.Web3Provider(window.ethereum); setProvider(web3Provider);
                const network = await web3Provider.getNetwork(); setChainId(network.chainId); logger.info("Network:", network);
                let currentSigner = web3Provider.getSigner(); setSigner(currentSigner);
                const signerAddressCheck = await currentSigner.getAddress();
                if(signerAddressCheck.toLowerCase() !== currentAccount.toLowerCase()){ throw new Error("Signer issue."); }
                logger.info("Signer verified:", signerAddressCheck);
                setAccount(currentAccount); setIsConnected(true); setAuthType('wallet');
                setupWalletListeners(); // Setup listeners after successful connection
                logger.info(`Wallet connected: ${currentAccount}. Proceeding to auth.`);
                let messageToSign;
                try {
                    messageToSign = `Sign this message to authenticate your wallet ${currentAccount.substring(0, 6)}...${currentAccount.substring(currentAccount.length - 4)} with TruthPoll. Nonce: ${Date.now()}`;
                    logger.debug("Requesting signature...");
                    const signature = await currentSigner.signMessage(messageToSign); logger.info("Signature obtained.");
                    logger.debug("Calling api.authenticateWithWallet...");
                    const isAuthenticated = await api.authenticateWithWallet(currentAccount, signature, messageToSign);
                    if (isAuthenticated) {
                        logger.info(`Backend auth OK: ${currentAccount}`); checkAdminStatus(); closeAuthModal(); setLoading(false); return true;
                    } else { logger.error(`Backend auth FAIL: ${currentAccount}.`); if (!error) setError('Auth failed.'); await logout(); setLoading(false); return false; }
                } catch (signOrAuthError) { setLoading(false); if (signOrAuthError.code === 4001) { setError('Signature required.'); } else { logger.error("Sign/Auth Error:", signOrAuthError); setError(`Auth error: ${signOrAuthError.message}`); } await logout(); return false; }
            } else { logger.warn("No accounts found."); setError("No accounts found."); setLoading(false); return false; }
        } catch (connectError) { setLoading(false); if (connectError.code === 4001) { setError('Connection denied.'); } else { logger.error("Connect Error:", connectError); setError(`Connection error: ${connectError.message}`); } return false; }
    };

    const loginWithMagic = async (method, params) => {
        // (Keep existing loginWithMagic logic)
         setLoading(true); setError(null);
        try {
            const magicInstance = createMagicInstance(); setMagic(magicInstance);
            if (!magicInstance) throw new Error('Magic not initialized');
            if (method === 'email') { await magicInstance.auth.loginWithMagicLink({ email: params.email }); setError("Check email."); setLoading(false); return false; }
            else if (method === 'google') { await magicInstance.oauth.loginWithRedirect({ provider: 'google', redirectURI: `${window.location.origin}/magic-callback` }); return false; }
            else { throw new Error('Unsupported Magic method'); }
        } catch (error) { logger.error("Magic login error:", error.message); setError(error.message); setLoading(false); return false; }
    };

    const getConnectionState = () => { // No need for useCallback if just returning state object
        return { isConnected, account, authType, provider, signer, chainId, isAdmin };
    };

    // --- Effects ---
    // Initialize on mount
    useEffect(() => {
        checkExistingAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run checkExistingAuth only once on mount

    // Run admin check when authenticated status changes
    useEffect(() => {
        if (isConnected && account) {
            checkAdminStatus();
        } else {
            setIsAdmin(false); // Ensure admin is false if not connected/no account
        }
    }, [isConnected, account]); // checkAdminStatus doesn't need to be a dep if defined inside like this


    // Provide state and functions to children
    return (
        <AuthContext.Provider
            value={{
                isConnected, account, authType, provider, signer, chainId, isAdmin,
                loading, error, showAuthModal,
                // Provide functions (using stable useCallback refs where appropriate)
                openAuthModal, closeAuthModal, connectWallet, loginWithMagic, logout, getConnectionState
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};