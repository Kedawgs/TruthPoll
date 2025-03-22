import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Web3Context } from '../context/Web3Context';
import createMagicInstance from '../config/magic';
import googleIcon from '../assets/google-icon.svg';
import metamaskIcon from '../assets/metamask-icon.svg';
import coinbaseIcon from '../assets/coinbase-icon.svg';
import phantomIcon from '../assets/phantom-icon.svg';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  
  const { 
    loginWithMagic, 
    connectWalletWithProvider, 
    loading, 
    error, 
    isConnected,
    completeMagicOAuthLogin
  } = useContext(Web3Context);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Improved OAuth redirect handling
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      try {
        // Check if we're in an OAuth redirect
        const searchParams = new URLSearchParams(window.location.search);
        const isOAuthRedirect = searchParams.has('magic_oauth_request_id');
        
        if (isOAuthRedirect) {
          console.log("Found OAuth redirect parameters. Attempting to finalize login...");
          
          // Get a Magic instance
          const magicInstance = createMagicInstance();
          
          if (magicInstance) {
            try {
              // This gets the result of the redirect
              console.log("Getting OAuth redirect result...");
              const result = await magicInstance.oauth.getRedirectResult();
              console.log("OAuth result received:", !!result);
              
              if (result) {
                // This should set up the user's session
                const userMetadata = await magicInstance.user.getMetadata();
                console.log("User authenticated:", userMetadata);
                
                // Check if logged in
                const isLoggedIn = await magicInstance.user.isLoggedIn();
                console.log("User is logged in:", isLoggedIn);
                
                // Complete login via context
                await completeMagicOAuthLogin();
                
                // Force a reload to ensure everything updates correctly
                window.location.href = '/';
              } else {
                console.error("No OAuth result received");
              }
            } catch (error) {
              console.error("Error processing OAuth redirect:", error);
            }
          } else {
            console.error("Magic instance not available for OAuth redirect");
          }
        }
      } catch (error) {
        console.error("Error handling OAuth redirect:", error);
      }
    };
    
    handleOAuthRedirect();
  }, [completeMagicOAuthLogin]);
  
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
      console.log("Starting Google login flow");
      const magicInstance = createMagicInstance();
      
      if (!magicInstance) {
        console.error("Magic instance not available for Google login");
        return;
      }
      
      console.log("Redirecting to Google OAuth...");
      // Use the dedicated callback route
      await magicInstance.oauth.loginWithRedirect({
        provider: 'google',
        redirectURI: `${window.location.origin}/magic-callback`
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
        <h2 className="text-2xl font-bold text-center mb-6">Sign Up</h2>
        
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
              Back to Login Options
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
          <p className="mt-2">
            This site is protected by hCaptcha and its Privacy Policy and Terms of Service apply.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;