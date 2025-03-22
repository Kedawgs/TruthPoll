const ethers = require('ethers');
const crypto = require('crypto');
const ProxyWallet = require('../models/ProxyWallet');

// Encryption key from environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/**
 * Service for managing proxy wallets
 */
class ProxyWalletService {
  /**
   * Initialize the service
   * @param {object} provider - An ethers.js provider
   */
  constructor(provider) {
    this.provider = provider;
    this.platformWallet = new ethers.Wallet(
      process.env.PLATFORM_WALLET_PRIVATE_KEY,
      provider
    );
  }

  /**
   * Encrypt a private key
   * @param {string} text - The text to encrypt
   * @return {string} The encrypted text
   */

  // Create a key buffer of correct length
  getKeyBuffer() {
    // Convert the hex string to a buffer if it's a hex string
    if (ENCRYPTION_KEY.match(/^[0-9a-f]{64}$/i)) {
      return Buffer.from(ENCRYPTION_KEY, 'hex');
    }
      
    // If it's not a valid hex string, hash it to get a consistent length
    return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  }

  // Encrypt a private key
  encrypt(text) {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create a cipher using AES-256-CBC algorithm with proper key length
    const key = this.getKeyBuffer();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV and encrypted text together
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt an encrypted private key
   * @param {string} text - The encrypted text
   * @return {string} The decrypted text
   */
  decrypt(text) {
    // Split the IV and encrypted text
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    // Create a decipher with proper key length
    const key = this.getKeyBuffer();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // Decrypt the text
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Create a new proxy wallet for a user
   * @param {string} userAddress - The user's address
   * @return {object} The wallet information
   */
  async createProxyWallet(userAddress) {
    try {
      // Check if user already has a proxy wallet
      let proxyWallet = await ProxyWallet.findOne({ userAddress });
      
      if (proxyWallet) {
        return {
          address: proxyWallet.proxyAddress
        };
      }
      
      // Generate a new random wallet
      const wallet = ethers.Wallet.createRandom();
      
      // Encrypt the private key
      const encryptedPrivateKey = this.encrypt(wallet.privateKey);
      
      // Store in the database
      proxyWallet = await ProxyWallet.create({
        userAddress,
        proxyAddress: wallet.address,
        encryptedPrivateKey
      });
      
      // Return only the public address (never expose the private key)
      return {
        address: wallet.address
      };
    } catch (error) {
      console.error('Error creating proxy wallet:', error);
      throw error;
    }
  }

  /**
   * Get a proxy wallet for a user
   * @param {string} userAddress - The user's address
   * @return {object} The ethers.js wallet instance
   */
  async getProxyWallet(userAddress) {
    try {
      const proxyWallet = await ProxyWallet.findOne({ userAddress });
      
      if (!proxyWallet) {
        return null;
      }
      
      // Decrypt the private key
      const privateKey = this.decrypt(proxyWallet.encryptedPrivateKey);
      
      // Create and return the wallet instance
      return new ethers.Wallet(privateKey, this.provider);
    } catch (error) {
      console.error('Error getting proxy wallet:', error);
      throw error;
    }
  }

  /**
   * Fund a proxy wallet with testnet MATIC
   * @param {string} userAddress - The user's address
   * @param {number} amount - Amount of MATIC to send
   * @return {object} Transaction receipt
   */
  async fundProxyWallet(userAddress, amount) {
    try {
      const proxyWallet = await ProxyWallet.findOne({ userAddress });
      
      if (!proxyWallet) {
        throw new Error('Proxy wallet not found');
      }
      
      // Send some testnet MATIC to the proxy wallet
      const tx = await this.platformWallet.sendTransaction({
        to: proxyWallet.proxyAddress,
        value: ethers.utils.parseEther(amount.toString())
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Update the balance in the database
      proxyWallet.balance += parseFloat(amount);
      proxyWallet.lastUsed = Date.now();
      await proxyWallet.save();
      
      return receipt;
    } catch (error) {
      console.error('Error funding proxy wallet:', error);
      throw error;
    }
  }

  /**
   * Execute a transaction using the proxy wallet
   * @param {string} userAddress - The user's address
   * @param {string} toAddress - Destination address
   * @param {string} data - Transaction data
   * @param {string} value - Amount of MATIC to send
   * @return {object} Transaction receipt
   */
  async executeTransaction(userAddress, toAddress, data, value = '0') {
    try {
      // Get the proxy wallet
      const wallet = await this.getProxyWallet(userAddress);
      
      if (!wallet) {
        throw new Error('Proxy wallet not found');
      }
      
      // Create the transaction
      const tx = await wallet.sendTransaction({
        to: toAddress,
        data,
        value: ethers.utils.parseEther(value.toString())
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Update last used timestamp
      await ProxyWallet.findOneAndUpdate(
        { userAddress },
        { lastUsed: Date.now() }
      );
      
      return receipt;
    } catch (error) {
      console.error('Error executing transaction:', error);
      throw error;
    }
  }
}

module.exports = ProxyWalletService;