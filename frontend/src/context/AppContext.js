// frontend/src/context/AppContext.js
import React from 'react';
import { AuthProvider } from './AuthContext';
import { ConfigProvider } from './ConfigContext'; // Add this import
import { WalletProvider } from './WalletContext';
import { ContractProvider } from './ContractContext';
import { UserProfileProvider } from './UserProfileContext';

// This component nests all the context providers to ensure proper dependency order
export const AppProvider = ({ children }) => {
  return (
    <ConfigProvider> {/* Add ConfigProvider as the outermost provider */}
      <AuthProvider>
        <WalletProvider>
          <UserProfileProvider>
            <ContractProvider>
              {children}
            </ContractProvider>
          </UserProfileProvider>
        </WalletProvider>
      </AuthProvider>
    </ConfigProvider>
  );
};

// Export all contexts for convenience
export { AuthContext } from './AuthContext';
export { ConfigContext } from './ConfigContext'; // Add this export
export { WalletContext } from './WalletContext';
export { ContractContext } from './ContractContext';
export { UserProfileContext } from './UserProfileContext';