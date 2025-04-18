// src/components/BalanceModal.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAppContext } from '../hooks/useAppContext';
import { formatAddress } from '../utils/web3Helper';
import api from '../utils/api'; // Import our API utility

const BalanceModal = ({ isOpen, onClose, refreshBalance }) => {
  // Tabs for the modal
  const [activeTab, setActiveTab] = useState('deposit');
  
  // Form state for amount
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Get necessary context values
  const { 
    account, 
    authType, 
    smartWalletAddress, 
    usdtBalance,
    signSmartWalletTransaction,
    provider
  } = useAppContext();
  
  // USDT token contract details
  const usdtAddress = process.env.REACT_APP_USDT_ADDRESS;
  
  // Reset state when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setError('');
      setSuccess('');
      setLoading(false);
      // Default to deposit for wallet users, withdraw for Magic users
      setActiveTab(authType === 'magic' ? 'withdraw' : 'deposit');
    }
  }, [isOpen, authType]);
  
  // Handle deposit from EOA to smart wallet
  const handleDeposit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Validation
      if (!amount || parseFloat(amount) <= 0) {
        setError('Please enter a valid amount');
        setLoading(false);
        return;
      }
      
      if (authType === 'magic') {
        setError('Deposits from Magic wallets are not supported yet');
        setLoading(false);
        return;
      }
      
      if (!smartWalletAddress) {
        setError('Smart wallet not found. Please try again');
        setLoading(false);
        return;
      }
      
      if (!window.ethereum) {
        setError('MetaMask not detected');
        setLoading(false);
        return;
      }
      
      // Get a fresh Web3Provider
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = web3Provider.getSigner();
      
      // Create USDT contract interface
      const usdtInterface = new ethers.utils.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ]);
      
      // Connect to the USDT contract
      const usdtContract = new ethers.Contract(usdtAddress, usdtInterface, signer);
      
      // Check decimals
      const decimals = await usdtContract.decimals();
      
      // Parse amount with correct decimals
      const parsedAmount = ethers.utils.parseUnits(amount, decimals);
      
      // Check user's EOA balance
      const balance = await usdtContract.balanceOf(account);
      if (balance.lt(parsedAmount)) {
        setError('Insufficient USDT balance in your wallet');
        setLoading(false);
        return;
      }
      
      // Transfer USDT to smart wallet
      const tx = await usdtContract.transfer(smartWalletAddress, parsedAmount);
      setSuccess(`Transaction submitted. Hash: ${tx.hash}`);
      
      // Wait for transaction to be confirmed
      await tx.wait();
      
      // Refresh balance after transaction
      await refreshBalance();
      
      setSuccess(`Successfully deposited ${amount} USDT to your smart wallet`);
      setLoading(false);
    } catch (error) {
      console.error('Deposit error:', error);
      setError(error.message || 'Failed to deposit USDT');
      setLoading(false);
    }
  };
  
  // Handle withdraw from smart wallet to EOA
  const handleWithdraw = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Validation
      if (!amount || parseFloat(amount) <= 0) {
        setError('Please enter a valid amount');
        setLoading(false);
        return;
      }
      
      // Check minimum withdrawal amount
      if (parseFloat(amount) < 5) {
        setError('Minimum withdrawal amount is 5 USDT');
        setLoading(false);
        return;
      }
      
      if (!smartWalletAddress && authType === 'wallet') {
        setError('Smart wallet not found');
        setLoading(false);
        return;
      }
      
      const withdrawalWallet = authType === 'magic' ? account : smartWalletAddress;
      
      // Get USDT decimals - use provider from context for read operations
      const usdtInterface = new ethers.utils.Interface([
        'function decimals() view returns (uint8)',
        'function balanceOf(address owner) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)'
      ]);
      
      const usdtContract = new ethers.Contract(usdtAddress, usdtInterface, provider);
      const decimals = await usdtContract.decimals();
      
      // Parse amount with correct decimals
      const parsedAmount = ethers.utils.parseUnits(amount, decimals);
      
      // Check balance
      const balance = await usdtContract.balanceOf(withdrawalWallet);
      if (balance.lt(parsedAmount)) {
        setError(`Insufficient USDT balance in your ${authType === 'magic' ? 'Magic' : 'smart'} wallet`);
        setLoading(false);
        return;
      }
      
      // For smart wallet users, sign the withdrawal transaction
      if (authType === 'wallet') {
        try {
          // Create the calldata for the USDT transfer function
          const transferCalldata = usdtInterface.encodeFunctionData('transfer', [
            account, // Transfer to the user's EOA
            parsedAmount
          ]);
          
          // Sign the transaction
          const signature = await signSmartWalletTransaction(
            usdtAddress, // Target is the USDT contract
            transferCalldata  // Call data is the transfer function
          );
          
          // Call backend to relay the transaction using our api utility
          const response = await api.post('/smart-wallets/relay-transaction', {
            smartWalletAddress,
            targetAddress: usdtAddress,
            callData: transferCalldata,
            signature,
            value: "0"
          });
          
          if (response.data.success) {
            setSuccess(`Withdrawal initiated. Transaction hash: ${response.data.data.transactionHash}`);
            
            // Wait 5 seconds before refreshing balance to allow transaction to be mined
            setTimeout(async () => {
              await refreshBalance();
              setSuccess(`Successfully withdrew ${amount} USDT to your wallet`);
              setLoading(false);
            }, 5000);
          } else {
            throw new Error(response.data.error || 'Transaction relay failed');
          }
        } catch (error) {
          console.error('Withdrawal signing error:', error);
          setError(`Failed to sign withdrawal: ${error.message}`);
          setLoading(false);
        }
      } else if (authType === 'magic') {
        // For Magic users, use their Magic wallet directly
        try {
          // Get signer from provider
          const magicSigner = provider.getSigner();
          
          // Create contract with signer
          const usdtWithSigner = new ethers.Contract(usdtAddress, usdtInterface, magicSigner);
          
          // Send transaction directly (Magic handles the gas)
          const tx = await usdtWithSigner.transfer(account, parsedAmount);
          
          setSuccess(`Transaction submitted. Hash: ${tx.hash}`);
          
          // Wait for transaction to be confirmed
          await tx.wait();
          
          // Refresh balance
          await refreshBalance();
          
          setSuccess(`Successfully withdrew ${amount} USDT to your account`);
          setLoading(false);
        } catch (error) {
          console.error('Magic withdrawal error:', error);
          setError(`Failed to withdraw: ${error.message}`);
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      setError(error.message || 'Failed to withdraw USDT');
      setLoading(false);
    }
  };
  
  // Function to handle max amount
  const handleMaxAmount = () => {
    if (activeTab === 'deposit') {
      // For deposits, will need to query EOA USDT balance
      setAmount('10'); // Placeholder - replace with actual balance fetch
    } else {
      // For withdrawals, use the current smart wallet balance
      setAmount(usdtBalance);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-white text-xl font-semibold">
              USDT Balance: {parseFloat(usdtBalance).toFixed(2)}
            </h2>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${
              activeTab === 'deposit' 
                ? 'text-primary-600 border-b-2 border-primary-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('deposit')}
            disabled={authType === 'magic'} // Disable deposit for Magic users
          >
            Deposit
          </button>
          <button
            className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${
              activeTab === 'withdraw' 
                ? 'text-primary-600 border-b-2 border-primary-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('withdraw')}
          >
            Withdraw
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Wallet Info */}
          <div className="mb-6">
            <div className="bg-gray-50 p-3 rounded-md">
              {activeTab === 'deposit' ? (
                <>
                  <div className="text-sm text-gray-500 mb-1">From Your Wallet</div>
                  <div className="text-gray-800 font-medium">{formatAddress(account)}</div>
                  
                  <div className="text-sm text-gray-500 mt-3 mb-1">To Smart Wallet</div>
                  <div className="text-gray-800 font-medium">{formatAddress(smartWalletAddress)}</div>
                </>
              ) : (
                <>
                  <div className="text-sm text-gray-500 mb-1">From {authType === 'magic' ? 'Magic Wallet' : 'Smart Wallet'}</div>
                  <div className="text-gray-800 font-medium">
                    {formatAddress(authType === 'magic' ? account : smartWalletAddress)}
                  </div>
                  
                  <div className="text-sm text-gray-500 mt-3 mb-1">To Your Wallet</div>
                  <div className="text-gray-800 font-medium">{formatAddress(account)}</div>
                </>
              )}
            </div>
          </div>
          
          {/* Form */}
          <form onSubmit={activeTab === 'deposit' ? handleDeposit : handleWithdraw}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (USDT)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="0.00"
                  step="0.01"
                  min={activeTab === 'withdraw' ? 5 : 0}
                />
                <button
                  type="button"
                  onClick={handleMaxAmount}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  MAX
                </button>
              </div>
              {activeTab === 'withdraw' && (
                <p className="text-xs text-gray-500 mt-1">Minimum withdrawal amount: 5 USDT</p>
              )}
            </div>
            
            {/* Fee info */}
            <div className="mb-6 text-sm text-gray-500">
              {activeTab === 'deposit' ? (
                <p>You will be responsible for gas fees when depositing.</p>
              ) : (
                <p>Withdrawal gas fees are covered by the TruthPoll platform.</p>
              )}
            </div>
            
            {/* Error and success messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm">
                {success}
              </div>
            )}
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || (authType === 'magic' && activeTab === 'deposit')}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Processing...
                </div>
              ) : (
                activeTab === 'deposit' ? 'Deposit USDT' : 'Withdraw USDT'
              )}
            </button>
            
            {/* Magic user deposit message */}
            {authType === 'magic' && activeTab === 'deposit' && (
              <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-700 text-sm">
                Direct deposits for Magic users are coming soon. Please contact support for assistance.
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default BalanceModal;