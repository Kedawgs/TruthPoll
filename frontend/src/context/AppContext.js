// src/context/AppContext.js

import React from 'react';
import { AuthProvider } from './AuthContext';
import { WalletProvider } from './WalletContext';
import { ContractProvider } from './ContractContext';
import { UserProfileProvider } from './UserProfileContext';

// This component nests all the context providers to ensure proper dependency order
export const AppProvider = ({ children }) => {
  return (
    <AuthProvider>
      <WalletProvider>
        <UserProfileProvider>
          <ContractProvider>
            {children}
          </ContractProvider>
        </UserProfileProvider>
      </WalletProvider>
    </AuthProvider>
  );
};

// Export all contexts for convenience
export { AuthContext } from './AuthContext';
export { WalletContext } from './WalletContext';
export { ContractContext } from './ContractContext';
export { UserProfileContext } from './UserProfileContext';