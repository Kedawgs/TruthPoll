const { Magic } = require('@magic-sdk/admin');

// Initialize Magic Admin SDK with your secret key
const magic = new Magic(process.env.MAGIC_SECRET_KEY);

module.exports = magic;