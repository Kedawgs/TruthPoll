// src/components/UsernameModal.js - Enhanced with Image Upload
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext';

const UsernameModal = () => {
  // Existing state
  const [username, setUsername] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [autoUsername, setAutoUsername] = useState('');
  const hasSubmittedRef = useRef(false);
  
  // New state for avatar
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);
  
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

  // Clean up avatar preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // Handle page navigation/refresh without setting username
  useEffect(() => {
    // Setup event listener for when user tries to navigate away
    const handleBeforeUnload = () => {
      if (termsAgreed && !hasSubmittedRef.current) {
        skipUsernameSetup();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // If the component is unmounting and user agreed to terms
      // AND we haven't already submitted a username manually
      if (termsAgreed && !hasSubmittedRef.current) {
        skipUsernameSetup();
      }
    };
  }, [termsAgreed, skipUsernameSetup]);

  // Handle avatar file change
  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setAvatarFile(file);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim() || !termsAgreed || profileLoading) {
      return;
    }

    // Set the submission flag FIRST - before any async operation
    hasSubmittedRef.current = true;
    
    // Save username to backend with avatar if available
    await saveUsername(username.trim(), false, avatarFile);
  };

  const handleSkip = async () => {
    if (termsAgreed) {
      // Set the submission flag FIRST - before any async operation
      hasSubmittedRef.current = true;
      
      await skipUsernameSetup();
    }
  };

  // Generate initials for avatar placeholder
  const getInitials = () => {
    if (username) {
      return username.charAt(0).toUpperCase();
    }
    return account ? account.substring(2, 3).toUpperCase() : '?';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50 font-sans">
      <div className="bg-white rounded-md max-w-md w-full mx-4 overflow-hidden shadow-xl">
        <div className="p-6">
          <div className="text-center mb-4">
            <h2 className="text-lg font-medium text-gray-800">Set up your profile</h2>
            <p className="text-sm text-gray-500">Choose a username and profile picture</p>
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
            
            {/* Avatar Upload Circle */}
            <div className="flex justify-center mb-5">
              <div 
                onClick={triggerFileInput}
                className="relative cursor-pointer group w-24 h-24 rounded-full overflow-hidden border-2 border-gray-300 flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-all"
              >
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="Avatar Preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-3xl font-semibold text-gray-500">
                    {getInitials()}
                  </div>
                )}
                
                {/* Overlay with camera icon on hover */}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            
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
                disabled={profileLoading || !username.trim() || !termsAgreed || hasSubmittedRef.current}
                className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition duration-200 font-medium"
              >
                {profileLoading ? 'Saving...' : 'Continue'}
              </button>
              
              {termsAgreed && (
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={hasSubmittedRef.current}
                  className="w-full text-gray-600 text-sm py-1 hover:text-gray-800 disabled:opacity-50"
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