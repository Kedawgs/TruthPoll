import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Web3Context } from '../context/Web3Context';
import createMagicInstance from '../config/magic';
import googleIcon from '../assets/google-icon.svg';
import metamaskIcon from '../assets/metamask-icon.svg';
import coinbaseIcon from '../assets/coinbase-icon.svg';
import phantomIcon from '../assets/phantom-icon.svg';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(true); // Set to true to prioritize email login
  
  const { 
    loginWithMagic, 
    connectWalletWithProvider, 
    loading, 
    error, 
    isConnected 
  } = useContext(Web3Context);
  
  const navigate = useNavigate();
  
  // Redirect if already connected
  useEffect(() => {
    if (isConnected) {
      navigate('/');
    }
  }, [isConnected, navigate]);
  
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    setEmailError('');
    const success = await loginWithMagic('email', { email });
    
    if (success) {
      navigate('/');
    }
  };
  
  const handleGoogleLogin = async () => {
    try {
      const magicInstance = createMagicInstance();
      
      if (!magicInstance) return;
      
      // Generate and store a consistent state parameter
      const state = `magic-${Date.now()}`;
      localStorage.setItem('magic_oauth_state', state);
      
      await magicInstance.oauth.loginWithRedirect({
        provider: 'google',
        redirectURI: `${window.location.origin}/magic-callback`,
        state
      });
    } catch (error) {
      console.error("Error starting Google login:", error);
    }
  };
  
  const handleWalletConnect = async (provider) => {
    const success = await connectWalletWithProvider(provider);
    
    if (success) {
      navigate('/');
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">Sign In / Sign Up</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
            <p>{error}</p>
          </div>
        )}
        
        {showEmailInput ? (
          <form onSubmit={handleEmailSubmit} className="mb-4">
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="your@email.com"
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
              {loading ? 'Signing in...' : 'Continue with Email'}
            </button>
            <button
              type="button"
              onClick={() => setShowEmailInput(false)}
              className="w-full mt-2 text-center text-sm text-gray-600 hover:text-gray-800"
            >
              Other Login Options
            </button>
          </form>
        ) : (
          <>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full mb-4 flex items-center justify-center bg-white border border-gray-300 rounded-md py-2 px-4 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <img src={googleIcon} alt="Google" className="h-5 w-5 mr-2" />
              Sign in with Google
            </button>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => handleWalletConnect('metamask')}
                disabled={loading}
                className="w-full flex items-center justify-center bg-white border border-gray-300 rounded-md py-2 px-4 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <img src={metamaskIcon} alt="MetaMask" className="h-5 w-5 mr-2" />
                MetaMask
              </button>
              
              <button
                onClick={() => handleWalletConnect('coinbase')}
                disabled={loading}
                className="w-full flex items-center justify-center bg-white border border-gray-300 rounded-md py-2 px-4 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <img src={coinbaseIcon} alt="Coinbase" className="h-5 w-5 mr-2" />
                Coinbase
              </button>
              
              <button
                onClick={() => handleWalletConnect('phantom')}
                disabled={loading}
                className="w-full flex items-center justify-center bg-white border border-gray-300 rounded-md py-2 px-4 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <img src={phantomIcon} alt="Phantom" className="h-5 w-5 mr-2" />
                Phantom
              </button>
              
              <button
                onClick={() => setShowEmailInput(true)}
                className="w-full text-center text-sm text-primary-600 hover:text-primary-800 mt-4"
              >
                Continue with Email instead
              </button>
            </div>
          </>
        )}
        
        <div className="mt-6 text-center text-xs text-gray-600">
          <div className="flex justify-center gap-2">
            <a href="/privacy" className="hover:text-gray-900">Privacy</a>
            <span>•</span>
            <a href="/terms" className="hover:text-gray-900">Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;