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
      
      magicInstance = new Magic(process.env.REACT_APP_MAGIC_PUBLISHABLE_KEY, {
        extensions: [
          new OAuthExtension()
        ]
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