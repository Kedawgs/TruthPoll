// frontend/src/hooks/useAppContext.js
import { useContext } from 'react';
import {
  AuthContext,
  ConfigContext,
  WalletContext,
  ContractContext,
  UserProfileContext
} from '../context/AppContext'; // Assuming AppContext exports the individual contexts

/**
 * Custom hook to access all contexts in one place.
 * This simplifies components that need data from multiple contexts by
 * consuming each individual context and returning a single combined object.
 */
export const useAppContext = () => {
  // Consume each individual context
  const auth = useContext(AuthContext);
  const config = useContext(ConfigContext);
  const wallet = useContext(WalletContext);
  const contract = useContext(ContractContext);
  const userProfileData = useContext(UserProfileContext); // Use a distinct variable name here

  // Combine all context values into a single object using spread syntax.
  // This automatically includes all properties provided by each context's value object.
  // Ensure there are no major naming conflicts between contexts, or handle them explicitly below.
  const combinedValue = {
    ...auth,
    ...config,
    ...wallet,
    ...contract,
    ...userProfileData // Spreads userProfile, setUserProfile, needsUsername, etc.
  };

  // Optional: You can explicitly override or add properties here if needed
  // For example, if two contexts provided 'loading' and you wanted specific names:
  // const combinedValueWithOverrides = {
  //   ...combinedValue,
  //   authIsLoading: auth.loading,
  //   configIsLoading: config.loading,
  // };
  // return combinedValueWithOverrides;

  // Return the combined object
  return combinedValue;
};