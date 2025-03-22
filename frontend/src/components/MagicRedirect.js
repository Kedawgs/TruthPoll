import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import createMagicInstance from '../config/magic';

const MagicRedirect = () => {
  const [status, setStatus] = useState('Processing authentication...');
  const navigate = useNavigate();

  useEffect(() => {
    const completeAuthentication = async () => {
      try {
        // Get Magic instance
        const magic = createMagicInstance();
        
        if (!magic) {
          setStatus('Error: Magic SDK not initialized');
          return;
        }
        
        // Just focus on completing the redirect
        console.log("Finishing OAuth flow...");
        
        try {
          // Just get the redirect result - don't try to get metadata yet
          const result = await magic.oauth.getRedirectResult();
          console.log("OAuth result obtained:", result);
          
          // Check if the user is logged in without using getMetadata
          const isLoggedIn = await magic.user.isLoggedIn();
          console.log("User logged in status:", isLoggedIn);
          
          if (isLoggedIn) {
            // Success! Redirect to home page
            console.log("Authentication successful, redirecting to home");
            window.location.href = '/';
          } else {
            // Something went wrong but no error was thrown
            setStatus('Authentication completed but login failed. Redirecting back to signup...');
            setTimeout(() => navigate('/signup'), 2000);
          }
        } catch (oauthError) {
          console.error("OAuth flow error:", oauthError);
          
          // Handle the OAuth state parameter mismatch error specifically
          if (oauthError.message && oauthError.message.includes('OAuth state parameter mismatches')) {
            setStatus('Authentication error: Session expired or invalid. Please try again.');
          } else {
            setStatus(`Authentication error: ${oauthError.message}`);
          }
          
          setTimeout(() => navigate('/signup'), 2000);
        }
      } catch (error) {
        console.error("Error in authentication process:", error);
        setStatus(`Authentication process error: ${error.message}`);
        setTimeout(() => navigate('/signup'), 2000);
      }
    };
    
    completeAuthentication();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Magic Authentication</h2>
        <p>{status}</p>
      </div>
    </div>
  );
};

export default MagicRedirect;