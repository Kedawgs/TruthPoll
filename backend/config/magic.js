const { Magic } = require('@magic-sdk/admin');

// Initialize Magic Admin SDK with your secret key
const magic = new Magic(process.env.MAGIC_SECRET_KEY);
console.log("Magic Secret Key exists:", !!process.env.MAGIC_SECRET_KEY); 
// This will log 'true' if the key exists and 'false' if it doesn't

module.exports = magic;