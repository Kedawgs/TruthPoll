// frontend/src/config/magic.js
import { Magic } from 'magic-sdk';
import { OAuthExtension } from '@magic-ext/oauth';

// Global Magic instance
let magicInstance = null;

const createMagicInstance = () => {
  if (typeof window === 'undefined') return null;

  try {
    // Only create the instance once
    if (!magicInstance) {
      console.log("Creating new Magic instance");
      // Remove this line that logs the key
      // console.log("Magic key used:", process.env.REACT_APP_MAGIC_PUBLISHABLE_KEY);

      // Configure Magic directly for Polygon Amoy using the 'network' option
      magicInstance = new Magic(process.env.REACT_APP_MAGIC_PUBLISHABLE_KEY, {
        extensions: [
          new OAuthExtension()
        ],
        network: {
          chainId: 80002, // Polygon Amoy testnet
          rpcUrl: process.env.REACT_APP_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/'
        }
      });

      console.log("Magic instance created:", !!magicInstance);
    }

    return magicInstance;
  } catch (error) {
    console.error("Error creating Magic instance:", error);
    return null;
  }
};

export default createMagicInstance;