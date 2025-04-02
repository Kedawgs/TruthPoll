// frontend/src/utils/api.js - Fixed version

import axios from 'axios';
import logger from './logger';

// Create an axios instance
const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
});

// --- Request Interceptor ---
api.interceptors.request.use(async (config) => {
    try {
        // First, mark specific endpoints that require auth
        const authRequiredEndpoints = [
            '/polls/upload-image',
            '/polls/vote',
            '/polls/nonce',
            '/polls/received-rewards'
        ];
        
        // Check if this is a protected endpoint first
        const isAuthRequired = authRequiredEndpoints.some(endpoint => 
            config.url.includes(endpoint));
        
        // Now define public endpoints
        const isPublicEndpoint =
            !isAuthRequired && // Not in our protected endpoints list
            (
              config.url.includes('/polls/search') ||
              (config.url.includes('/polls') && config.method === 'get') ||
              config.url.includes('/auth/verify-token') || 
              config.url.includes('/auth/verify') || 
              config.url.includes('/auth/verify-signature') || 
              config.url.includes('/auth/is-address-admin/') ||
              (config.url.includes('/smart-wallets/') && config.method === 'get')
            );

        logger.debug(`Request URL: ${config.url}, Method: ${config.method}, Auth Required: ${!isPublicEndpoint}`);

        if (!isPublicEndpoint) {
            // Use JWT Token primarily if available
            const authToken = localStorage.getItem('authToken');

            if (authToken) {
                logger.debug('Attaching authToken (JWT) to request header.');
                config.headers.Authorization = `Bearer ${authToken}`;
            } else {
                logger.warn('No authentication token (JWT) available for protected endpoint');
                
                // Dispatch event for wallet-specific auth requirements
                if (config.url.includes('/smart-wallets') && config.method === 'post') {
                    window.dispatchEvent(new CustomEvent('wallet:auth:required'));
                }
                
                // If this is the image upload endpoint, log a specific message
                if (config.url.includes('/polls/upload-image')) {
                    logger.error('Authentication token missing for image upload');
                }
            }
            
            // Log authentication status
            logger.debug(`Auth header present: ${!!config.headers.Authorization}`);
        } else {
            logger.debug('Skipping auth header for public endpoint.');
        }
    } catch (error) {
        logger.error('Error in auth request interceptor:', error);
    }
    return config;
}, (error) => {
    logger.error('Request interceptor error:', error);
    return Promise.reject(error);
});


// --- Response Interceptor ---
api.interceptors.response.use(
    (response) => {
        // Store wallet address if present
        if (response.data?.data?.publicAddress) {
            localStorage.setItem('walletAddress', response.data.data.publicAddress.toLowerCase());
        }
        
        // Store wallet data if it's a wallet endpoint response
        if (response.config.url.includes('/smart-wallets') && 
            response.data?.data?.address && 
            response.data.success) {
            localStorage.setItem('smartWalletAddress', response.data.data.address);
        }
         
        // Store JWT if returned
        if (response.data?.token) {
            logger.debug("Response contains token - updating stored token.");
            localStorage.setItem('authToken', response.data.token);
            localStorage.setItem('isAuthenticated', 'true');
        }

        return response;
    },
    (error) => {
        if (error.response) {
            logger.error(`API Error: ${error.response.status} ${JSON.stringify(error.response.data)}`);
            
            // Special handling for unauthorized image upload
            if (error.response.status === 401 && error.config.url.includes('/polls/upload-image')) {
                logger.error('Authentication failed for image upload - check if you are properly logged in');
                
                // We could redirect to auth here, but let's just log for now
                // window.dispatchEvent(new CustomEvent('auth:required'));
            }
            
            // Handle 401 errors
            if (error.response.status === 401) {
                const isTokenError = error.response.data?.error?.toLowerCase().includes('token');
                
                if (isTokenError) {
                    logger.error('Authentication error: Invalid or expired token.');
                } else {
                    logger.error('Authentication error: 401 Unauthorized.');
                }

                // Check for smart wallet specific auth errors
                if (error.config.url.includes('/smart-wallets')) {
                    logger.error('Authentication required for wallet operations');
                    window.dispatchEvent(new CustomEvent('wallet:auth:required'));
                }

                // Don't automatically clear credentials for image upload errors
                // This way we don't log the user out if there's an issue
                if (!error.config.url.includes('/polls/upload-image')) {
                    // Clear potentially invalid credentials
                    api.logout();
                }
            }
        } else if (error.request) {
            logger.error('Network error - no response received:', error.request);
        } else {
            logger.error('Request setup error:', error.message);
        }
        return Promise.reject(error);
    }
);

// *** Wallet Signature Authentication Helper ***
api.authenticateWithWallet = async (address, signature, message) => {
    try {
        logger.debug(`Sending verification request to /auth/verify-signature for ${address}`);
        
        const response = await api.post('/auth/verify-signature', {
            walletAddress: address,
            signature: signature,
            message: message
        });

        if (response.data.success && response.data.token) {
            logger.info("Wallet signature verified successfully by backend.");
            localStorage.setItem('walletAddress', address.toLowerCase());
            localStorage.setItem('authToken', response.data.token);
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.removeItem('walletSignature');
            return true;
        } else {
            logger.error(`Backend verification failed: ${response.data.error || 'No token received'}`);
            api.logout();
            return false;
        }
    } catch (error) {
        logger.error('Wallet authentication API call error:', error.isAxiosError ? error.message : error);
        api.logout();
        return false;
    }
};

// API helper to verify the token with backend
api.verifyToken = async () => {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            throw new Error("No auth token found");
        }
        
        // Make a request to verify the token
        // Usually this would be a lightweight endpoint to check token validity
        const response = await api.get('/auth/check-admin');
        
        // If we get here, the token is valid
        return true;
    } catch (error) {
        logger.error('Token verification failed:', error);
        return false;
    }
};

// Logout helper
api.logout = () => {
    logger.debug("API Logout: Clearing authentication artifacts.");
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('authToken');
    localStorage.removeItem('walletSignature');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('smartWalletAddress');
    
    // Dispatch global events
    window.dispatchEvent(new CustomEvent('auth:logout'));
};

export default api;