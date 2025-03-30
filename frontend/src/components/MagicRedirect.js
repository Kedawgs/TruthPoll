// src/components/MagicRedirect.js
import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AppContext';
import createMagicInstance from '../config/magic';

const MagicRedirect = () => {
  const [status, setStatus] = useState('Finalizing authentication...');
  const navigate = useNavigate();
  
  // Using AuthContext directly since we only need auth functions
  const { isConnected } = useContext(AuthContext);

  useEffect(() => {
    // If already connected, redirect home
    if (isConnected) {
      navigate('/');
      return;
    }

    const completeAuthentication = async () => {
      try {
        // Get Magic instance
        const magic = createMagicInstance();
        
        if (!magic) {
          setStatus('Authentication error: Magic SDK not initialized');
          setTimeout(() => navigate('/signup'), 2000);
          return;
        }
        
        try {
          // Try to get the redirect result
          await magic.oauth.getRedirectResult();
          console.log("OAuth redirect successful");
        } catch (oauthError) {
          // Log the error but continue checking if we're logged in anyway
          console.error('OAuth redirect error:', oauthError);
          
          // Only show the error message if it's not the state parameter mismatch
          if (!oauthError.message || !oauthError.message.includes('OAuth state parameter mismatches')) {
            setStatus(`Authentication error: ${oauthError.message}`);
            setTimeout(() => navigate('/signup'), 2000);
            return;
          }
          
          // For state parameter mismatch, continue to check login status
          console.log("Continuing despite OAuth state parameter mismatch...");
        }
        
        // Check if the user is logged in regardless of OAuth errors
        try {
          const isLoggedIn = await magic.user.isLoggedIn();
          console.log("User logged in status:", isLoggedIn);
          
          if (isLoggedIn) {
            // We're logged in despite any errors, redirect to home
            setStatus('Authentication successful! Redirecting...');
            setTimeout(() => window.location.href = '/', 1000);
          } else {
            // Not logged in, go back to signup
            setStatus('Authentication failed. Please try again.');
            setTimeout(() => navigate('/signup'), 2000);
          }
        } catch (loginCheckError) {
          console.error("Error checking login status:", loginCheckError);
          setStatus('Error verifying authentication. Please try again.');
          setTimeout(() => navigate('/signup'), 2000);
        }
      } catch (error) {
        console.error("Error in authentication process:", error);
        setStatus(`Authentication process error: ${error.message}`);
        setTimeout(() => navigate('/signup'), 2000);
      }
    };
    
    completeAuthentication();
  }, [navigate, isConnected]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Magic Authentication</h2>
        <p className="mb-4">{status}</p>
        
        {/* Add a loading spinner */}
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      </div>
    </div>
  );
};

export default MagicRedirect;