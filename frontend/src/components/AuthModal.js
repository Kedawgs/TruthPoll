// src/components/AuthModal.js
import React, { useState, useContext } from 'react';
import { Web3Context } from '../context/Web3Context';
import createMagicInstance from '../config/magic';
import googleIcon from '../assets/google-icon.svg';
import metamaskIconModern from '../assets/metamask-icon-modern.svg';
import coinbaseIcon from '../assets/coinbase-icon.svg';
import phantomIcon from '../assets/phantom-icon.svg';

const AuthModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false); // Start with wallet options
  
  const { 
    loginWithMagic, 
    connectWallet,
    loading, 
    error
  } = useContext(Web3Context);
  
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    // Add logging here
    console.log("Attempting login with email:", email);
    
    setEmailError('');
    const success = await loginWithMagic('email', { email });
    
    if (success) {
      onClose();
    }
  };
  
  const handleGoogleLogin = async () => {
    try {
      await loginWithMagic('google');
    } catch (error) {
      console.error("Error starting Google login:", error);
    }
  };
  
  const handleWalletConnect = async () => {
    const success = await connectWallet();
    
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 relative">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-2xl font-bold text-center mb-6">Welcome to TruthPoll</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
            <p>{error}</p>
          </div>
        )}
        
        {showEmailInput ? (
          // Email Input Screen
          <form onSubmit={handleEmailSubmit} className="mb-4">
            {/* Back button */}
            <button
              type="button"
              onClick={() => setShowEmailInput(false)}
              className="mb-4 flex items-center text-gray-600 hover:text-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back
            </button>
            
            <div className="mb-4">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter Email"
              />
              {emailError && (
                <p className="mt-1 text-sm text-red-600">{emailError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>
        ) : (
          // Wallet Options Screen
          <>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center bg-white border border-gray-300 rounded-md py-2 px-4 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <img src={googleIcon} alt="Google" className="h-5 w-5 mr-2" />
              Continue with Google
            </button>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div 
                className="border border-gray-300 rounded-md p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50" 
                onClick={handleWalletConnect}
              >
                <img src={metamaskIconModern} alt="MetaMask" className="h-8 w-8 mb-2" />
                <span className="text-sm">MetaMask</span>
              </div>
              
              <div className="border border-gray-300 rounded-md p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 opacity-50">
                <img src={coinbaseIcon} alt="Coinbase" className="h-8 w-8 mb-2" />
                <span className="text-sm">Coinbase</span>
              </div>
              
              <div className="border border-gray-300 rounded-md p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 opacity-50">
                <img src={phantomIcon} alt="Phantom" className="h-8 w-8 mb-2" />
                <span className="text-sm">Phantom</span>
              </div>
              
              <div className="border border-gray-300 rounded-md p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
                <span className="text-sm">More</span>
              </div>
            </div>
            
            <div className="text-center">
              <button
                onClick={() => setShowEmailInput(true)}
                className="text-primary-600 hover:text-primary-800 text-sm font-medium"
              >
                Use Email Instead
              </button>
            </div>
          </>
        )}
        
        <div className="mt-6 text-center text-xs text-gray-600 flex justify-center space-x-2">
          <a href="/privacy" className="hover:text-gray-900">Privacy</a>
          <span>•</span>
          <a href="/terms" className="hover:text-gray-900">Terms</a>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;