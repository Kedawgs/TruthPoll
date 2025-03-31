// backend/controllers/authController.js
const ethers = require('ethers');
const jwt = require('jsonwebtoken'); // Make sure 'jsonwebtoken' is installed (npm install jsonwebtoken)
const { AuthenticationError } = require('../utils/errorTypes');
const logger = require('../utils/logger');

// Assume verifyToken function exists here...
exports.verifyToken = async (req, res, next) => {
    // Example structure - IMPLEMENT YOUR TOKEN VERIFICATION LOGIC (e.g., Magic DID)
    try {
        const { didToken } = req.body; // Example: Expecting a DID token
        if (!didToken) {
            throw new AuthenticationError('Please provide a DID token');
        }

        // --- Your Logic to Verify the DID Token ---
        // This will depend heavily on how Magic Link (or other DID provider) works.
        // You might need Magic Admin SDK or other libraries.
        // const decodedData = await verifyMagicToken(didToken); // Placeholder for verification logic
        // const userAddress = decodedData.publicAddress; // Get address from decoded token
        // --- End Placeholder ---

        // If verification is successful, generate your *own* session JWT
        const payload = {
             publicAddress: userAddress, // Address derived from DID token
             // Add any other relevant user info IF verified by the token
             isMagicUser: true // Indicate this user authenticated via Magic/Token
        };

        // Sign the JWT
        const sessionToken = jwt.sign(
            payload,
            process.env.JWT_SECRET, // Make sure JWT_SECRET is set in your .env
            { expiresIn: process.env.JWT_EXPIRES_IN || '1d' } // Set expiration (e.g., '1h', '1d', '7d')
        );

         logger.info(`Session token generated for token user: ${userAddress}`);
         res.status(200).json({
            success: true,
            token: sessionToken, // Send back the session token
            // Optionally send back user address if needed by frontend immediately
             data: { publicAddress: userAddress }
        });

    } catch (error) {
        logger.error('Token verification failed:', error);
        // Ensure error is passed correctly to error handling middleware
        if (!(error instanceof AuthenticationError)) {
             // If it's not already an auth error, wrap it or create a generic one
             next(new AuthenticationError(error.message || 'Token verification failed'));
        } else {
             next(error); // Pass existing AuthenticationError
        }
    }
};

// *** NEW CONTROLLER for standard wallet signature verification ***
exports.verifyWalletSignature = async (req, res, next) => {
    try {
        const { walletAddress, signature, message } = req.body;

        if (!walletAddress || !signature || !message) {
            throw new AuthenticationError('Missing required fields: walletAddress, signature, and message');
        }

        logger.debug(`Attempting signature verification for address: ${walletAddress}`);
        logger.debug(`Message signed: ${message}`);
        logger.debug(`Signature: ${signature}`);

        // Verify the signature
        let recoveredAddress;
        try {
             recoveredAddress = ethers.utils.verifyMessage(message, signature);
             logger.debug(`Recovered address from signature: ${recoveredAddress}`);
        } catch (verifyError) {
             // Handle potential errors during verification itself (e.g., malformed signature)
             logger.error('Error during ethers.utils.verifyMessage:', verifyError);
             throw new AuthenticationError('Invalid signature format or verification failed');
        }


        // Compare the recovered address with the provided address
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            logger.warn(`Signature verification failed: Recovered address ${recoveredAddress} does not match provided address ${walletAddress}`);
            throw new AuthenticationError('Signature verification failed: Address mismatch');
        }

        logger.info(`Signature successfully verified for address: ${walletAddress}`);

        // Signature is valid, generate a session JWT
        const payload = {
            publicAddress: walletAddress, // Use the verified address
            isMagicUser: false // Indicate this user authenticated via signature
            // Add any other standard claims if needed (e.g., iat - issued at)
        };

        // Sign the JWT
        const sessionToken = jwt.sign(
            payload,
            process.env.JWT_SECRET, // CRITICAL: Use a strong secret from environment variables
            { expiresIn: process.env.JWT_EXPIRES_IN || '1d' } // Set expiration
        );

        logger.info(`Session token generated for wallet user: ${walletAddress}`);

        // Send the session token back to the frontend
        res.status(200).json({
            success: true,
            token: sessionToken // The JWT session token
        });

    } catch (error) {
        // Pass error to the centralized error handler
        next(error);
    }
};


// Assume checkAdminStatus function exists here...
exports.checkAdminStatus = (req, res, next) => {
     // This controller runs *after* isAuthenticated middleware, so req.user exists
    try {
        const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
        const isAdmin = adminAddresses.includes(req.user.publicAddress.toLowerCase());

        res.status(200).json({
            success: true,
            data: { isAdmin }
        });
    } catch (error) {
         next(error); // Pass errors to error handler
    }
};