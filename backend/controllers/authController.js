// backend/controllers/authController.js
// Corrected version addressing the jwt.sign exp/expiresIn conflict

const ethers = require('ethers');
const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('../utils/errorTypes'); // Assuming you have custom error types
const logger = require('../utils/logger'); // Assuming a logger utility
const magic = require('../config/magic'); // Import the initialized Magic Admin SDK instance

/**
 * Verifies a Magic DID Token, generates a session JWT if valid.
 */
exports.verifyToken = async (req, res, next) => {
    try {
        const { didToken } = req.body;

        if (!didToken) {
            throw new AuthenticationError('Please provide a DID token');
        }

        logger.debug("Received DID token for verification");

        try {
            // Step 1: Validate the DID token with Magic Admin SDK
            // This checks the token's signature, expiration, etc. using Magic's keys
            magic.token.validate(didToken); // This should not be awaited according to docs, it's synchronous validation
            logger.info("Magic DID token validated successfully");

            // Step 2: Get user metadata associated with the valid token
            const metadata = await magic.users.getMetadataByToken(didToken);
            logger.info(`User metadata retrieved: Email=${metadata.email}, Address=${metadata.publicAddress}`);

            if (!metadata || !metadata.publicAddress) {
                throw new AuthenticationError('Could not retrieve user metadata from Magic.');
            }
            const userAddress = metadata.publicAddress;

            // Step 3: Generate your application's session JWT
            // Define the payload for your JWT
            const payload = {
                publicAddress: userAddress,
                email: metadata.email, // Include email if useful
                isMagicUser: true, // Flag indicating authentication method
                // Add other relevant, non-sensitive user data if needed
                iat: Math.floor(Date.now() / 1000), // Issued at timestamp (standard claim)
                // DO NOT set 'exp' here if using 'expiresIn' option below
            };

            // Sign the JWT using your secret and set expiration via options
            const sessionToken = jwt.sign(
                payload,
                process.env.JWT_SECRET, // Ensure JWT_SECRET is set in your .env file
                {
                    expiresIn: process.env.JWT_EXPIRES_IN || '1d' // Use expiresIn option (e.g., '1d', '7d', '3h')
                }
            );

            logger.info(`JWT session token generated for Magic user: ${userAddress}`);

            // Step 4: Check if the user is an admin (optional)
            const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
            const isAdmin = adminAddresses.includes(userAddress.toLowerCase());

            // Step 5: Return the successful response with the JWT
            res.status(200).json({
                success: true,
                token: sessionToken, // Your application's JWT
                data: { // Include relevant user data for the frontend
                    publicAddress: userAddress,
                    email: metadata.email,
                    isAdmin
                }
            });
        } catch (magicError) {
            // Catch errors specifically from Magic validation or metadata fetch
            logger.error("Magic SDK error during token verification/metadata fetch:", magicError);
            // Respond with 401 for invalid Magic tokens/sessions
            res.status(401).json({ success: false, error: 'Invalid or expired Magic session token.' });
            // Note: We handle the response directly here instead of throwing AuthenticationError
            // to avoid the generic error handling below for this specific 401 case.
            // Alternatively, keep the throw and let the global error handler manage it.
            // throw new AuthenticationError('Invalid DID token');
        }
    } catch (error) {
        // Catch errors like missing token or potentially errors thrown from the inner catch
        logger.error('verifyToken controller error:', error);
        next(error); // Pass to the global error handling middleware
    }
};

/**
 * Verifies a standard wallet signature (EIP-4361 style), generates session JWT if valid.
 */
exports.verifyWalletSignature = async (req, res, next) => {
    try {
        const { walletAddress, signature, message } = req.body;

        if (!walletAddress || !signature || !message) {
            throw new AuthenticationError('Missing required fields: walletAddress, signature, and message');
        }

        logger.debug(`Attempting signature verification for address: ${walletAddress}`);
        logger.debug(`Message signed: ${message}`);
        // Avoid logging full signature in production if possible
        // logger.debug(`Signature: ${signature}`);

        // Step 1: Verify the signature using ethers
        let recoveredAddress;
        try {
            recoveredAddress = ethers.utils.verifyMessage(message, signature);
            logger.debug(`Recovered address from signature: ${recoveredAddress}`);
        } catch (verifyError) {
            // Handle potential errors during signature verification (e.g., malformed signature)
            logger.error('Error during ethers.utils.verifyMessage:', verifyError);
            throw new AuthenticationError('Invalid signature format or verification failed');
        }

        // Step 2: Compare the recovered address with the provided address (case-insensitive)
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            logger.warn(`Signature verification failed: Recovered address ${recoveredAddress} does not match provided address ${walletAddress}`);
            throw new AuthenticationError('Signature verification failed: Address mismatch');
        }

        logger.info(`Signature successfully verified for address: ${walletAddress}`);

        // Step 3: Check if the user is an admin (optional)
        const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
        const isAdmin = adminAddresses.includes(walletAddress.toLowerCase());

        // Step 4: Signature is valid, generate your application's session JWT
        const payload = {
            publicAddress: walletAddress,
            isMagicUser: false, // Flag indicating authentication method
            isAdmin,
            iat: Math.floor(Date.now() / 1000), // Issued at timestamp
             // DO NOT set 'exp' here if using 'expiresIn' option below
        };

        // Sign the JWT using your secret and set expiration via options
        const sessionToken = jwt.sign(
            payload,
            process.env.JWT_SECRET, // Ensure JWT_SECRET is set
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '1d' // Use expiresIn option
            }
        );

        logger.info(`Session token generated for wallet user: ${walletAddress}`);

        // Step 5: Send the session token back to the frontend
        res.status(200).json({
            success: true,
            token: sessionToken, // Your application's JWT
            data: { // Include relevant user data
                publicAddress: walletAddress,
                isAdmin
            }
        });

    } catch (error) {
         // Catch AuthenticationErrors thrown above or any other unexpected errors
        logger.error('verifyWalletSignature controller error:', error);
        next(error); // Pass error to the global error handling middleware
    }
};

/**
 * Checks if the currently authenticated user (from JWT) is an admin.
 * Assumes previous middleware (like JWT verification) has populated req.user.
 */
exports.checkAdminStatus = (req, res, next) => {
    try {
        // Check if req.user was populated by a preceding auth middleware
        if (!req.user || !req.user.publicAddress) {
            // This case should ideally be caught by an 'isAuthenticated' middleware first
            throw new AuthenticationError('User not properly authenticated.');
        }

        const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
        const isAdmin = adminAddresses.includes(req.user.publicAddress.toLowerCase());

        res.status(200).json({
            success: true,
            data: { isAdmin }
        });
    } catch (error) {
        logger.error('checkAdminStatus controller error:', error);
        next(error); // Pass error to the global error handling middleware
    }
};

// Remember to add a route in authRoutes.js that uses this controller if needed,
// typically protected by a middleware that verifies your application's JWT.