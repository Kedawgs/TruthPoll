// src/components/UsernameModal.js
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext';

const UsernameModal = () => {
  // State for form and interaction
  const [username, setUsername] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [autoUsername, setAutoUsername] = useState('');
  
  // Get data from context
  const {
    account,
    profileLoading,
    profileError,
    setUsername: saveUsername,
    skipUsernameSetup,
    generateUsernameFromAddress
  } = useAppContext();

  // Generate auto username when component mounts
  useEffect(() => {
    if (account) {
      const generatedUsername = generateUsernameFromAddress(account);
      setAutoUsername(generatedUsername);
    }
  }, [account, generateUsernameFromAddress]);

  // Handle page navigation/refresh without setting username
  useEffect(() => {
    // Setup event listener for when user tries to navigate away
    const handleBeforeUnload = () => {
      // Don't show confirmation dialog but handle automatic username assignment
      if (termsAgreed) {
        skipUsernameSetup();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // If the component is unmounting and user agreed to terms, auto-assign username
      if (termsAgreed) {
        skipUsernameSetup();
      }
    };
  }, [termsAgreed, skipUsernameSetup]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      return;
    }

    if (!termsAgreed) {
      return;
    }
    
    // Save username to backend
    await saveUsername(username.trim());
  };

  const handleSkip = async () => {
    if (termsAgreed) {
      await skipUsernameSetup();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50 font-sans">
      <div className="bg-white rounded-md max-w-md w-full mx-4 overflow-hidden shadow-xl">
        <div className="p-6">
          <div className="text-center mb-4">
            <h2 className="text-lg font-medium text-gray-800">Choose a username</h2>
            <p className="text-sm text-gray-500">You can update this later.</p>
            {autoUsername && (
              <p className="text-xs text-gray-400 mt-1">
                If skipped, you'll be assigned: {autoUsername}
              </p>
            )}
          </div>
          
          <form onSubmit={handleSubmit}>
            {profileError && (
              <div className="mb-4 p-2 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
                <p>{profileError}</p>
              </div>
            )}
            
            <div className="mb-5">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))} // Remove spaces
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="@username"
                autoFocus
              />
            </div>
            
            <div className="mb-5">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={() => setTermsAgreed(!termsAgreed)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-gray-700">
                  By trading, you agree to the <a href="/terms" className="text-blue-600 hover:underline">Terms of Use</a> and attest you are not a U.S. person, are not located in the U.S. and are not the resident of or located in a restricted jurisdiction
                </span>
              </label>
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={profileLoading || !username.trim() || !termsAgreed}
                className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition duration-200 font-medium"
              >
                {profileLoading ? 'Saving...' : 'Continue'}
              </button>
              
              {termsAgreed && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full text-gray-600 text-sm py-1 hover:text-gray-800"
                >
                  Skip for now
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UsernameModal;