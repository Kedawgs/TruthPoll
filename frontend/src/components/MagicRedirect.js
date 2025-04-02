// src/components/MagicRedirect.js - Refined Version

import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers'; // Import ethers if needed for provider creation here

// Adjust the path if your context file is named differently or located elsewhere
import { AuthContext } from '../context/AuthContext';
import createMagicInstance from '../config/magic';
import api from '../utils/api'; // Your axios instance wrapper
import logger from '../utils/logger'; // Your logging utility

const MagicRedirect = () => {
    const [status, setStatus] = useState('Finalizing authentication...');
    const navigate = useNavigate();
    const { isConnected, setMagicUserSession } = useContext(AuthContext); // Get the new context function
    const processing = useRef(false); // Guard to prevent double execution

    useEffect(() => {
        // --- Guard against double execution in StrictMode ---
        if (processing.current) {
            logger.debug("MagicRedirect: Already processing, skipping effect run.");
            return;
        }
        processing.current = true;
        logger.debug("MagicRedirect: Starting OAuth result processing.");
        // ----------------------------------------------------

        // If user somehow lands here already connected, redirect away
        if (isConnected) {
             logger.info("MagicRedirect: Already connected, redirecting home.");
             // Use replace to avoid adding this redirect page to history
             navigate('/', { replace: true });
             return;
         }

        const completeAuthentication = async () => {
            let magic; // Define magic instance for potential use across try/catch/finally
            try {
                magic = createMagicInstance();
                if (!magic) {
                    // This case should be rare if createMagicInstance is reliable
                    throw new Error('Magic SDK could not be initialized');
                }

                logger.info("Attempting to get OAuth redirect result...");
                // This is the critical step that validates the state and processes the result
                const result = await magic.oauth.getRedirectResult();
                logger.info("OAuth redirect result processed successfully:", result ? "Data received" : "No data (check Magic dashboard config if unexpected)");

                // If we reach here, the state mismatch error (if any) was handled internally by the SDK
                // or didn't occur. Now, get the user details.
                const userMetadata = await magic.user.getInfo();
                logger.info("User metadata received:", userMetadata);

                if (!userMetadata || !userMetadata.publicAddress) {
                    throw new Error("Could not get user metadata or public address from Magic after successful redirect.");
                }
                const userAccount = userMetadata.publicAddress;

                // Get the DID token required for backend verification
                // Set a reasonable lifespan (e.g., 5 minutes) for the token
                const didToken = await magic.user.getIdToken({ lifespan: 60 * 5 });
                logger.info("DID token received:", didToken ? "Yes" : "No");

                if (!didToken) {
                    throw new Error("Could not retrieve DID token after OAuth success. Please try logging in again.");
                }

                // Call backend API to verify the DID token and exchange it for a session JWT
                logger.info("Verifying Magic token with backend...");
                const response = await api.post('/auth/verify', { didToken });

                // Check if backend verification was successful and returned a token
                if (response.data && response.data.token) {
                    logger.info("JWT token received from backend");

                    // --- Store session info in localStorage ---
                    localStorage.setItem('authToken', response.data.token);
                    localStorage.setItem('isAuthenticated', 'true');
                    localStorage.setItem('walletAddress', userAccount.toLowerCase());

                    logger.info("LocalStorage after successful authentication:");
                    logger.info(`- authToken: ${localStorage.getItem('authToken') ? 'Present' : 'Missing'}`);
                    logger.info(`- isAuthenticated: ${localStorage.getItem('isAuthenticated')}`);
                    logger.info(`- walletAddress: ${localStorage.getItem('walletAddress')}`);
                    // --- End localStorage ---

                    // --- Update AuthContext State ---
                    if (!setMagicUserSession) {
                        logger.error("AuthContext critical error: setMagicUserSession function is missing!");
                        throw new Error("Application setup error. Cannot update authentication state.");
                    }

                    // Prepare data for AuthContext state update
                    const magicProvider = new ethers.providers.Web3Provider(magic.rpcProvider);
                    const magicSigner = magicProvider.getSigner();
                    let currentChainId = null;
                    try {
                         const network = await magicProvider.getNetwork();
                         currentChainId = network.chainId;
                     } catch (networkErr) {
                         logger.error("Could not get network info from Magic provider:", networkErr);
                     }

                    // Call the context function to set the application state
                    await setMagicUserSession({
                        provider: magicProvider,
                        signer: magicSigner,
                        account: userAccount,
                        chainId: currentChainId,
                        magicInstance: magic // Pass instance if AuthContext needs it
                    });
                    // --- End AuthContext Update ---

                    setStatus('Authentication successful! Redirecting...');
                    // Redirect to the main application area after a short delay
                    setTimeout(() => navigate('/', { replace: true }), 1000);

                } else {
                    // Backend verification might have succeeded but didn't return a token
                    logger.error("Backend verification did not return a JWT token.", response.data);
                    throw new Error("Authentication incomplete: Backend did not provide a session token.");
                }

            } catch (error) {
                logger.error("Error during Magic OAuth authentication flow:", error);

                // Provide specific feedback based on the error
                 if (error.message && error.message.includes('OAuth state parameter mismatches')) {
                     setStatus('Authentication failed: Security validation error. Please ensure you are not using multiple tabs or incognito mode inappropriately, and try logging in again.');
                 } else if (error.response && error.response.status === 401) {
                     // Handle 401 from the backend '/auth/verify' call
                     const backendError = error.response?.data?.error || 'Invalid session token';
                     setStatus(`Authentication failed: Backend verification error (${backendError}). Please try again.`);
                 } else if (error.message && error.message.includes("DID token")) {
                     setStatus(`Authentication failed: Could not retrieve necessary token. Please try logging in again.`);
                 }
                 else {
                    // Generic error message
                    setStatus(`Authentication error: ${error.message}. Please try logging in again.`);
                }

                // Redirect back to login page after showing error for a few seconds
                setTimeout(() => navigate('/login', { replace: true }), 4000);
            }
        };

        // Execute the authentication process
        completeAuthentication();

    // --- Dependency Array ---
    // Ensures the effect runs only once when the component mounts.
    // Include functions from context/router if they are stable (useCallback/memo).
    // isConnected is checked at the start, so including it might cause re-runs if context updates mid-process.
    // Best practice here is usually an empty array + ref guard for mount-only effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, setMagicUserSession]); // Added stable dependencies
    // ----------------------

    // Render loading/status indicator
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Magic Authentication</h2>
                <p className="mb-6 text-gray-600 dark:text-gray-400">{status}</p>

                {/* Loading Spinner */}
                <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
                </div>
            </div>
        </div>
    );
};

export default MagicRedirect;