// backend/config/passport.js
const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const logger = require('../utils/logger'); // Assuming logger path

// Options for JWT Strategy
const options = {
    // Extract JWT from the Authorization header as a Bearer token
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    // Use the SAME secret key that you use to SIGN the tokens
    secretOrKey: process.env.JWT_SECRET,
    // You can add other options like audience, issuer if you set them during signing
};

// Configure the JWT strategy
passport.use(new JwtStrategy(options, async (jwt_payload, done) => {
    try {
        // jwt_payload contains the decoded token data (e.g., { publicAddress: '...', iat: ..., exp: ... })
        logger.debug('JWT Payload Received:', jwt_payload);

        // Here, you could optionally look up the user in your DB if needed
        // const user = await User.findOne({ publicAddress: jwt_payload.publicAddress });
        // if (user) {
        //    return done(null, user); // Attach full user object to req.user
        // } else {
        //    return done(null, false); // Or fail if user not found
        // }

        // For simple cases, just attach the payload directly
        if (jwt_payload.publicAddress) {
            // Attach the essential info to req.user
            return done(null, {
                 publicAddress: jwt_payload.publicAddress,
                 // Include isMagicUser if it's in the payload (set during signing)
                 isMagicUser: jwt_payload.isMagicUser || false
                });
        } else {
            logger.warn('JWT payload missing publicAddress');
            return done(null, false); // Indicate authentication failure
        }
    } catch (error) {
        logger.error('Error during JWT strategy verification:', error);
        return done(error, false); // Indicate error
    }
}));

module.exports = passport; // Export configured passport instance