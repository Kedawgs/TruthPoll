const { Magic } = require('@magic-sdk/admin');

// Check if the key exists
if (!process.env.MAGIC_SECRET_KEY) {
  throw new Error('MAGIC_SECRET_KEY environment variable is not set. Authentication will not work properly.');
}

// Initialize Magic Admin SDK with your secret key
const magic = new Magic(process.env.MAGIC_SECRET_KEY);

module.exports = magic;