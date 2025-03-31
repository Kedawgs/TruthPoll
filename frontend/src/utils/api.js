// frontend/src/utils/api.js
import axios from 'axios';
import logger from './logger';

// Create an axios instance
const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
});

// --- Request Interceptor ---
// (No changes needed here - it already prioritizes authToken)
api.interceptors.request.use(async (config) => {
    try {
        const isPublicEndpoint =
            config.url.includes('/polls/search') ||
            (config.url.includes('/polls') && config.method === 'get' && !config.url.includes('/vote') && !config.url.includes('/nonce') && !config.url.includes('/received-rewards')) || // Refined public GET /polls and /polls/:id check
            config.url.includes('/auth/verify-token') || // Adjusted if you rename verify endpoint
            config.url.includes('/auth/verify') || // Keep if verify handles both or only tokens
            config.url.includes('/auth/verify-signature') || // Authentication endpoints are public initially
            config.url.includes('/auth/is-address-admin/'); // Public check

        logger.debug(`Request URL: ${config.url}, Method: ${config.method}, Public: ${isPublicEndpoint}`);

        if (!isPublicEndpoint) {
            // Use JWT Token primarily if available
            const authToken = localStorage.getItem('authToken');

            if (authToken) {
                logger.debug('Attaching authToken (JWT) to request header.');
                config.headers.Authorization = `Bearer ${authToken}`;
            } else {
                 // Fallback or specific cases might use signature - but generally JWT is used after login
                 // const walletSignature = localStorage.getItem('walletSignature');
                 // if (walletSignature) {
                 //   logger.debug('Adding wallet signature to request header (fallback).');
                 //   config.headers['X-Wallet-Signature'] = walletSignature;
                 // } else {
                 //   logger.warn('No authentication token or signature available for protected endpoint');
                 // }
                 logger.warn('No authentication token (JWT) available for protected endpoint');
            }
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
// (No changes needed here - it already clears tokens on 401)
api.interceptors.response.use(
    (response) => {
        // This part is now handled within api.authenticateWithWallet on successful login
        // We don't expect the JWT token to come from /auth/verify anymore, but from /auth/verify-signature
        // Keeping this structure is fine, but the specific logic for storing token
        // should primarily live where the login/verification happens.

        // Store wallet address if present (can come from various responses)
        if (response.data?.data?.publicAddress) {
            localStorage.setItem('walletAddress', response.data.data.publicAddress.toLowerCase());
        }
         // Store JWT if returned by any successful request (e.g., profile refresh might return new token)
         // But primary storage happens in authenticateWithWallet now
         if (response.data?.token) {
              logger.debug("Response contains token - potentially updating stored token.");
              localStorage.setItem('authToken', response.data.token);
              localStorage.setItem('isAuthenticated', 'true'); // Ensure this stays true if token is refreshed
         }


        return response;
    },
    (error) => {
        if (error.response) {
            logger.error(`API Error: ${error.response.status} ${JSON.stringify(error.response.data)}`);
            if (error.response.status === 401) {
                 // Check if it's specifically an 'Invalid token' type of 401 if backend provides details
                 const isTokenError = error.response.data?.error?.toLowerCase().includes('token');
                 if (isTokenError) {
                    logger.error('Authentication error: Invalid or expired token.');
                 } else {
                    logger.error('Authentication error: 401 Unauthorized.');
                 }

                // Clear potentially invalid credentials and trigger logout globally
                 api.logout(); // Use the logout helper
            }
        } else if (error.request) {
            logger.error('Network error - no response received:', error.request);
        } else {
            logger.error('Request setup error:', error.message);
        }
        return Promise.reject(error);
    }
);

// *** UPDATED: Wallet Signature Authentication Helper ***
api.authenticateWithWallet = async (address, signature, message) => {
    try {
        logger.debug(`Sending verification request to /auth/verify-signature for ${address}`);
        // Call the NEW backend endpoint
        const response = await api.post('/auth/verify-signature', {
            walletAddress: address,
            signature: signature,
            message: message // Send the original signed message
        });

        // Expect backend to return { success: true, token: 'jwt_token' } on success
        if (response.data.success && response.data.token) {
            logger.info("Wallet signature verified successfully by backend.");
            localStorage.setItem('walletAddress', address.toLowerCase());
            // Store the JWT session token
            localStorage.setItem('authToken', response.data.token);
            localStorage.setItem('isAuthenticated', 'true');
            // Clear old signature if it exists, JWT is primary now
            localStorage.removeItem('walletSignature');
            return true; // Indicate success
        } else {
            // Backend indicated failure even with a 2xx response (should ideally return non-2xx on failure)
             logger.error(`Backend verification failed (Success: ${response.data.success}): ${response.data.error || 'No token received'}`);
             // Clear potentially inconsistent state
             api.logout();
             return false;
        }
    } catch (error) {
        // Catch Axios errors (like the 400 Bad Request, or network errors)
        // The response interceptor already logs details for non-2xx status codes
        logger.error('Wallet authentication API call error:', error.isAxiosError ? error.message : error);
        // Ensure state is clean after failed auth attempt
        api.logout();
        return false; // Indicate failure
    }
};

// Logout helper - now clears JWT token primarily
api.logout = () => {
    logger.debug("API Logout: Clearing authentication artifacts.");
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('authToken'); // Clear JWT
    localStorage.removeItem('walletSignature'); // Clear old signature just in case
    localStorage.removeItem('walletAddress');
    // Optionally clear other user-related data if needed
    // Dispatch global event for other parts of the app (handled by interceptor on 401 too)
    window.dispatchEvent(new CustomEvent('auth:logout'));
};

export default api;