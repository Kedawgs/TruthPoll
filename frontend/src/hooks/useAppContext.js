// src/hooks/useAppContext.js

import { useContext } from 'react';
import { 
  AuthContext,
  WalletContext,
  ContractContext,
  UserProfileContext
} from '../context/AppContext';

/**
 * Custom hook to access all contexts in one place
 * This simplifies components that need data from multiple contexts
 */
export const useAppContext = () => {
  const auth = useContext(AuthContext);
  const wallet = useContext(WalletContext);
  const contract = useContext(ContractContext);
  const userProfile = useContext(UserProfileContext);
  
  // Return all context values combined
  return {
    // Auth context
    isConnected: auth.isConnected,
    account: auth.account,
    authType: auth.authType,
    provider: auth.provider,
    signer: auth.signer,
    chainId: auth.chainId,
    authLoading: auth.loading,
    authError: auth.error,
    showAuthModal: auth.showAuthModal,
    openAuthModal: auth.openAuthModal,
    closeAuthModal: auth.closeAuthModal,
    connectWallet: auth.connectWallet,
    loginWithMagic: auth.loginWithMagic,
    logout: auth.logout,
    
    // Wallet context
    smartWalletAddress: wallet.smartWalletAddress,
    usdtBalance: wallet.usdtBalance,
    walletLoading: wallet.walletLoading,
    walletError: wallet.walletError,
    getSmartWalletAddress: wallet.getSmartWalletAddress,
    deploySmartWalletIfNeeded: wallet.deploySmartWalletIfNeeded,
    getUSDTBalance: wallet.getUSDTBalance,
    refreshUSDTBalance: wallet.refreshUSDTBalance,
    
    // Contract context
    pollLoading: contract.pollLoading,
    pollError: contract.pollError,
    createPoll: contract.createPoll,
    votePoll: contract.votePoll,
    claimReward: contract.claimReward,
    getPolls: contract.getPolls,
    getPoll: contract.getPoll,
    getClaimableRewards: contract.getClaimableRewards,
    endPoll: contract.endPoll,
    reactivatePoll: contract.reactivatePoll,
    
    // User Profile context
    userProfile: userProfile.userProfile,
    needsUsername: userProfile.needsUsername,
    profileLoading: userProfile.profileLoading,
    profileError: userProfile.profileError,
    setUsername: userProfile.setUsername,
    skipUsernameSetup: userProfile.skipUsernameSetup,
    generateUsernameFromAddress: userProfile.generateUsernameFromAddress
  };
};