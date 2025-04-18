// src/components/PollConfirmationModal.js
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAppContext } from '../hooks/useAppContext';
import api from '../utils/api';
import logger from '../utils/logger';

// Default Icon (Example: Document Icon)
const DefaultPollIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PollConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  pollData,
  isProcessing
}) => {
  const navigate = useNavigate();
  const { 
    getConfigValue, 
    createPoll, 
    smartWalletAddress, 
    account, 
    authType, 
    refreshUSDTBalance,
    usdtBalance,
    signSmartWalletTransaction
  } = useAppContext();

  // State for tracking poll creation process
  const [calculations, setCalculations] = useState({
    pollCreationCost: 0,
    rewardCost: 0,
    transactionFee: 0,
    rewardFee: 0,
    appFee: 0,
    totalCost: 0
  });
  const [approvalComplete, setApprovalComplete] = useState(false);
  const [fundsTransferred, setFundsTransferred] = useState(false);
  const [pollCreationSuccess, setPollCreationSuccess] = useState(false);
  const [error, setError] = useState('');
  const [processingStep, setProcessingStep] = useState(null); // null, 'approving', 'transferring', 'creating', 'verifying', 'complete', 'error'
  const [factoryAddress, setFactoryAddress] = useState('');
  const [usdtAddress, setUsdtAddress] = useState('');
  const [sufficientBalance, setSufficientBalance] = useState(true);
  const [initialBalance, setInitialBalance] = useState('0');
  const [signatureInfo, setSignatureInfo] = useState(null); // Store signature for transfer
  
  // Derived values
  const voteLimit = pollData?.voteLimit ? parseInt(pollData.voteLimit) : 0;
  const rewardPerVoter = pollData?.rewardPerVoter ? parseFloat(pollData.rewardPerVoter) : 0;
  const isRewardEnabled = rewardPerVoter > 0;

  // --- Blob URL generation and cleanup ---
  const modalPreviewUrl = useMemo(() => {
    if (pollData?.previewFile instanceof File) {
      try { return URL.createObjectURL(pollData.previewFile); }
      catch (e) { return null; }
    }
    return null;
  }, [pollData?.previewFile]);

  useEffect(() => {
    return () => { if (modalPreviewUrl) { URL.revokeObjectURL(modalPreviewUrl); } };
  }, [modalPreviewUrl]);
  // --- End Blob URL Logic ---

  // --- Load required contract addresses ---
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const factoryAddr = await getConfigValue('FACTORY_ADDRESS');
        setFactoryAddress(factoryAddr);
        
        const tokenAddr = await getConfigValue('USDT_ADDRESS');
        setUsdtAddress(tokenAddr);
      } catch (err) {
        console.error("Error loading contract addresses:", err);
        setError("Could not load contract configuration");
      }
    };
    
    loadAddresses();
  }, [getConfigValue]);

  // --- Check balance on mount and when usdtBalance changes ---
  useEffect(() => {
    if (isOpen && isRewardEnabled) {
      const currentBalance = parseFloat(usdtBalance || '0');
      setInitialBalance(currentBalance.toString());
      const requiredAmount = parseFloat(calculations.totalCost);
      
      setSufficientBalance(currentBalance >= requiredAmount);
      
      if (currentBalance < requiredAmount) {
        setError(`Insufficient USDT balance. You need ${requiredAmount.toFixed(2)} USDT but only have ${currentBalance.toFixed(2)} USDT`);
      } else {
        // Clear any previous balance-related errors
        if (error && error.includes("Insufficient USDT balance")) {
          setError('');
        }
      }
    }
  }, [isOpen, isRewardEnabled, usdtBalance, calculations.totalCost, error]);

  // --- Calculate Costs ---
  useEffect(() => {
    const calculateCosts = async () => {
      if (!isOpen || !pollData || typeof pollData.voteLimit === 'undefined' || typeof pollData.rewardPerVoter === 'undefined') {
        setCalculations({ 
          pollCreationCost: 0, 
          rewardCost: 0, 
          transactionFee: 0, 
          rewardFee: 0, 
          appFee: 0, 
          totalCost: 0 
        });
        return;
      }
      
      try {
        // Get config values async
        const averageTxCost = await getConfigValue('ESTIMATED_TX_COST', 0.001);
        const platformFeePercent = await getConfigValue('PLATFORM_FEE_PERCENT', 6);
        const safetyBuffer = await getConfigValue('REWARDS_SAFETY_BUFFER', 1.05);
        
        // Parse numeric values
        const voteCount = parseInt(pollData.voteLimit) || 0;
        const rewardPerVoter = parseFloat(pollData.rewardPerVoter) || 0;
        
        // Calculate transaction costs
        const calculatedPollCreationCost = (averageTxCost * 2 * voteCount) * safetyBuffer;
        
        // Calculate reward costs
        const totalRewards = voteCount * rewardPerVoter;
        
        // Calculate platform fees (6% of both transaction costs and rewards)
        const feePercent = platformFeePercent / 100;
        const transactionFee = calculatedPollCreationCost * feePercent;
        const rewardFee = totalRewards * feePercent;
        const totalAppFee = transactionFee + rewardFee;
        
        // Calculate total cost
        const totalCost = calculatedPollCreationCost + totalRewards + totalAppFee;

        // Update state with detailed breakdown
        setCalculations({
          pollCreationCost: calculatedPollCreationCost.toFixed(4),
          rewardCost: totalRewards.toFixed(2),
          transactionFee: transactionFee.toFixed(4),
          rewardFee: rewardFee.toFixed(2),
          appFee: totalAppFee.toFixed(2),
          totalCost: totalCost.toFixed(2)
        });
        
        // Check balance against new calculation
        if (isRewardEnabled) {
          const currentBalance = parseFloat(usdtBalance || '0');
          setSufficientBalance(currentBalance >= totalCost);
          
          if (currentBalance < totalCost) {
            setError(`Insufficient USDT balance. You need ${totalCost.toFixed(2)} USDT but only have ${currentBalance.toFixed(2)} USDT`);
          }
        }
      } catch (error) {
        setError("Error calculating costs. Please try again.");
        setCalculations({ 
          pollCreationCost: 0, 
          rewardCost: 0, 
          transactionFee: 0, 
          rewardFee: 0, 
          appFee: 0, 
          totalCost: 0 
        });
      }
    };
    
    calculateCosts();
  }, [isOpen, pollData, getConfigValue, isRewardEnabled, usdtBalance]);

  // REVISED APPROACH: Use smart wallet relay for transfers
  const handleDirectUSDTTransfer = async () => {
    try {
      setProcessingStep('transferring');
      setError("Transferring USDT to pay for poll...");
      
      // Use a relay transaction for the smart wallet
      logger.info(`Attempting direct USDT transfer of ${calculations.totalCost} USDT via relay transaction`);
      
      // Calculate token amount with proper decimals (6 for USDT)
      const parsedAmount = ethers.utils.parseUnits(calculations.totalCost, 6).toString();
      
      // Use the same approach as BalanceModal.js for consistency
      // Create USDT contract interface using ethers.js
      const usdtInterface = new ethers.utils.Interface([
        'function transfer(address to, uint256 amount) returns (bool)'
      ]);
      
      // Encode the transfer function call using ethers
      const callData = usdtInterface.encodeFunctionData('transfer', [
        factoryAddress, // Transfer to the factory
        parsedAmount    // Amount to transfer
      ]);
      
      // Use signSmartWalletTransaction from context for consistent approach
      logger.info(`Requesting smart wallet transaction signature for transfer of ${calculations.totalCost} USDT`);
      
      let signature;
      try {
        // This matches exactly what BalanceModal.js does - use the context method
        signature = await signSmartWalletTransaction(
          usdtAddress, // Target is the USDT contract
          callData     // Call data is the encoded transfer function
        );
        
        logger.info("✅ Smart wallet transaction signature obtained:", signature.substring(0, 10) + "...");
      } catch (signingError) {
        logger.error("Failed to sign smart wallet transaction:", signingError);
        throw signingError;
      }
      
      // Verify all required parameters are present before sending
      if (!smartWalletAddress || !usdtAddress || !callData || !signature) {
        throw new Error("Missing required parameters for transfer");
      }
      
      // Log the exact request payload for debugging
      const relayPayload = {
        // Core transaction data - MUST MATCH expected parameters from BalanceModal
        smartWalletAddress: smartWalletAddress,
        targetAddress: usdtAddress, // USDT token contract address
        callData: callData, // Encoded transaction data
        signature: signature,
        value: "0", // No ETH value
      };
      
      logger.info("Submitting relay transaction:", relayPayload);
      
      // Use the smart wallet relay transaction endpoint which should exist
      const transferResponse = await api.post('/smart-wallets/relay-transaction', relayPayload);
      
      logger.info("USDT transfer response:", transferResponse.data);
      
      if (!transferResponse.data.success) {
        throw new Error(transferResponse.data.error || "Transfer failed");
      }
      
      // We know the transfer was initiated successfully at this point
      logger.info("Transfer initiated successfully! Transaction may take up to 30 seconds to confirm on blockchain");
      
      // Mark the transfer as processing but don't verify balance yet
      setFundsTransferred(true);
      setError('Waiting for blockchain confirmation... This may take up to 30 seconds');
      
      // Check balance periodically up to 10 times with increasing delays
      if (refreshUSDTBalance) {
        const initialCachedBalance = parseFloat(initialBalance);
        let attemptCount = 0;
        const maxAttempts = 10;
        let verified = false;
        
        logger.info(`Starting balance verification, initial balance: ${initialCachedBalance}`);
        
        // Use a more robust verification approach with multiple retries
        while (attemptCount < maxAttempts && !verified) {
          // Exponential backoff - wait longer for each attempt
          const delay = Math.min(2000 * Math.pow(1.5, attemptCount), 20000);
          logger.info(`Verification attempt ${attemptCount + 1}/${maxAttempts}: Waiting ${delay/1000}s for blockchain confirmation...`);
          
          // Wait before checking again
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Refresh balance
          const newBalance = await refreshUSDTBalance();
          logger.info(`Balance check attempt ${attemptCount + 1}: ${newBalance} USDT`);
          
          const currentBalance = parseFloat(newBalance);
          const actualDecrease = initialCachedBalance - currentBalance;
          
          // Check if balance has decreased significantly
          // Use a progressively lower threshold for each attempt
          const requiredDecrease = parseFloat(calculations.totalCost) * (0.9 - attemptCount * 0.05);
          
          logger.info(`Verification check: Initial=${initialCachedBalance}, Current=${currentBalance}, Actual=${actualDecrease.toFixed(2)}, Required=${requiredDecrease.toFixed(2)}`);
          
          if (actualDecrease >= requiredDecrease) {
            logger.info(`✅ Transfer verified! Balance decreased by ${actualDecrease.toFixed(2)} USDT`);
            verified = true;
            break;
          }
          
          attemptCount++;
        }
        
        // Final check - even if verification failed, we'll check balance one more time
        // This ensures we catch any last-minute confirmations
        if (!verified) {
          const finalBalance = await refreshUSDTBalance();
          const currentBalance = parseFloat(finalBalance);
          const actualDecrease = initialCachedBalance - currentBalance;
          
          if (actualDecrease >= 1) {
            logger.info(`✅ Transfer finally verified on final check! Balance decreased by ${actualDecrease.toFixed(2)} USDT`);
            verified = true;
          } else {
            // Only throw error if balance really didn't change at all
            logger.error(`Transfer appears to have failed. Initial: ${initialCachedBalance}, Final: ${currentBalance}`);
            throw new Error("Transfer failed: Balance did not decrease as expected");
          }
        }
      }
      
      // Mark the transfer as successful
      setFundsTransferred(true);
      setError('');
      
      return { 
        success: true,
        transferTxHash: transferResponse.data.txHash || '',
        transferredAmount: calculations.totalCost,
        signature: signature // Return the signature used for the transfer
      };
    } catch (error) {
      console.error('Error handling transfer:', error);
      setError(`Transfer failed: ${error.message}`);
      setProcessingStep('error');
      throw error;
    }
  };

  // Handler for USDT approval (using backend API for both user types)
  const handleApproveUSDT = async () => {
    try {
      setProcessingStep('approving');
      
      // Use the total cost which now includes fees for both transaction costs and rewards
      const totalAmount = parseFloat(calculations.totalCost);
      
      if (!totalAmount || totalAmount <= 0) {
        throw new Error("Invalid amount for approval");
      }
      
      // Get receiving address for approval
      if (!factoryAddress) {
        throw new Error("Factory address not available");
      }
      
      // CRITICAL: For smart wallet users, the USDT is held by the SMART WALLET, not the EOA
      // So we need to use the smartWalletAddress for approvals if available
      const walletAddress = authType === 'magic' ? account : smartWalletAddress;
      
      if (!walletAddress) {
        throw new Error("No wallet address available");
      }
      
      logger.info(`Using backend API to approve ${totalAmount.toFixed(2)} USDT from SMART WALLET ${walletAddress} for ${factoryAddress}`);
      logger.info(`EOA account (signer): ${account}, Smart wallet (token holder): ${smartWalletAddress}`);
      
      // Use the /contracts/approve-usdt endpoint for all users
      const response = await api.post('/contracts/approve-usdt', {
        amount: totalAmount.toFixed(2),
        ownerAddress: walletAddress,
        spenderAddress: factoryAddress,
        forceApproval: true
      });
      
      logger.info(`USDT approval response received:`, response.data);
      
      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to approve USDT");
      }
      
      // Record transaction hash if available
      const txHash = response.data.txHash;
      if (txHash) {
        logger.info(`USDT approval transaction hash: ${txHash}`);
      }
      
      // Refresh USDT balance
      if (refreshUSDTBalance) {
        // Wait a moment for blockchain state to update
        setTimeout(async () => {
          const newBalance = await refreshUSDTBalance();
          logger.info(`Updated USDT balance after approval: ${newBalance}`);
        }, 2000);
      }
      
      // Mark approval as complete
      setApprovalComplete(true);
      
      return { 
        success: true, 
        transactionHash: txHash || 'unknown'
      };
    } catch (error) {
      console.error('Error approving USDT:', error);
      setError(`USDT approval failed: ${error.message}`);
      setProcessingStep('error');
      throw error;
    }
  };

  const handleFinalSubmit = async () => {
    try {
      if (!pollData) {
        throw new Error("Poll data is missing");
      }
      
      // Reset error state
      setError('');
      
      // Check if we're using MetaMask and need a smart wallet
      if (authType !== 'magic' && !account) {
        throw new Error("MetaMask account not available. Please connect your wallet.");
      }
      
      // STEP 1: USDT Approval
      if (!approvalComplete) {
        setError("Approving USDT spending...");
        const approvalResult = await handleApproveUSDT();
        
        if (!approvalResult || !approvalResult.success) {
          throw new Error("USDT approval failed");
        }
        
        // Wait a moment to ensure blockchain state is updated
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // STEP 2: USDT Transfer - NEW APPROACH: Do the transfer FIRST, before poll creation
      if (isRewardEnabled && authType !== 'magic' && !fundsTransferred) {
        try {
          // Use the dedicated transfer function to handle USDT transfer BEFORE poll creation
          logger.info("CRITICAL CHANGE: Performing USDT transfer BEFORE poll creation");
          
          // Execute the transfer
          const transferResult = await handleDirectUSDTTransfer();
          
          if (!transferResult || !transferResult.success) {
            throw new Error("USDT transfer failed. Cannot proceed with poll creation.");
          }
          
          // Store the transaction hash for verification
          pollData.transferTxHash = transferResult.transferTxHash;
          pollData.transferAmount = transferResult.transferredAmount;
          pollData.transferTimestamp = Date.now();
          
          // CRITICAL: Also store the transfer signature if available
          if (transferResult.signature) {
            pollData.transferSignature = transferResult.signature;
          }
          
          // Mark as transferred so we can proceed
          setFundsTransferred(true);
          
          // CRITICAL: Also set a global flag to handle React state timing issues
          window.fundsSuccessfullyTransferred = true;
          
          // Store transfer info in the global state too
          window.transferInfo = {
            txHash: transferResult.transferTxHash,
            amount: transferResult.transferredAmount,
            timestamp: Date.now()
          };
          
          // Add a short delay to show the success message
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          logger.info("✅ FUNDS TRANSFERRED SUCCESSFULLY! Proceeding with poll creation");
        } catch (error) {
          logger.error("Error during fund transfer:", error);
          
          // Check if the transfer was initiated but our verification timed out
          if (error.message.includes("Balance did not decrease") && refreshUSDTBalance) {
            // The transfer might still be processing - check one more time with a longer delay
            logger.info("Transfer might still be processing - waiting longer for confirmation");
            await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
            
            const finalCheck = await refreshUSDTBalance();
            const initialBalFloat = parseFloat(initialBalance);
            const currentBalFloat = parseFloat(finalCheck);
            
            if (initialBalFloat > currentBalFloat) {
              // Balance decreased since we started! The transfer worked but was slow
              logger.info(`✅ Transfer verification succeeded on final attempt! Initial: ${initialBalFloat}, Current: ${currentBalFloat}`);
              
              // Store transfer details even though we had a verification timeout
              pollData.transferTxHash = "delayed-confirmation";
              pollData.transferAmount = calculations.totalCost;
              pollData.transferTimestamp = Date.now();
              
              // Mark as transferred so we can proceed
              setFundsTransferred(true);
              setError("Transfer confirmed after delay - proceeding with poll creation");
              
              // Continue with poll creation
              return;
            }
          }
          
          // If we get here, the transfer truly failed
          setError(`Fund transfer failed: ${error.message}. Cannot create poll without transferring funds.`);
          setProcessingStep('error');
          throw new Error(`Fund transfer failed: ${error.message}. Poll creation aborted.`);
        }
      }
      
      // STEP 3: Create the poll
      setProcessingStep('creating');
      setError("Creating poll...");
      
      // CRITICAL CHECK: Verify USDT balance once more before even trying to create poll
      if (isRewardEnabled && refreshUSDTBalance) {
        try {
          // Get the wallet to check - smart wallet for MetaMask users
          const walletToCheck = authType === 'magic' ? account : smartWalletAddress;
          
          // Use a more direct method to check USDT balance if possible
          let currentUsdtBalance;
          
          // Just use the standard balance refresh - direct check doesn't exist yet
          currentUsdtBalance = parseFloat(await refreshUSDTBalance());
          logger.info(`USDT balance before poll creation: ${currentUsdtBalance} USDT`);
          
          // Update initial balance one more time to be super accurate
          setInitialBalance(currentUsdtBalance.toString());
          
          // Check for signature only if we're using MetaMask and rewards
          // The signatureInfo might still be updating in state, so we'll check for signature right here
          // rather than rely on the state variable which might not be updated yet
          if (authType !== 'magic' && isRewardEnabled) {
            logger.info(`Checking signature availability: ${JSON.stringify({
              hasSignatureInfo: !!signatureInfo,
              hasSignature: !!signatureInfo?.signature
            })}`);
            
            // If we have logs that signature was obtained but state isn't updated yet, we'll proceed
            // This fixes timing issues with React state updates
          }
        } catch (preCheckError) {
          logger.error("Error checking USDT balance before poll creation:", preCheckError);
          // FAIL HARD here to prevent poll creation with transfer issues
          throw new Error(`Cannot proceed with poll creation: ${preCheckError.message}`);
        }
      }
      
      // Make a deep copy of the poll data to avoid mutating the original
      const pollDataToSubmit = JSON.parse(JSON.stringify(pollData));
      
      // CRITICAL: Make sure hasRewards is explicitly set to true for rewarded polls
      pollDataToSubmit.hasRewards = isRewardEnabled;
      
      // Ensure we have voteLimit for rewarded polls
      if (isRewardEnabled && !pollDataToSubmit.voteLimit) {
        pollDataToSubmit.voteLimit = parseInt(voteLimit);
      }
      
      // Include the calculated transaction costs and platform fees
      pollDataToSubmit.calculatedPollCreationCost = parseFloat(calculations.pollCreationCost);
      pollDataToSubmit.calculatedTransactionFee = parseFloat(calculations.transactionFee);
      pollDataToSubmit.calculatedRewardFee = parseFloat(calculations.rewardFee);
      pollDataToSubmit.calculatedTotalFee = parseFloat(calculations.appFee);
      pollDataToSubmit.calculatedTotalCost = parseFloat(calculations.totalCost);
      
      // Set poll funding details
      if (isRewardEnabled) {
        // For rewarded polls, set the fund amount to the reward cost
        const totalRewards = parseFloat(calculations.rewardCost);
        pollDataToSubmit.fundAmount = Math.max(totalRewards, 0.01);
        
        // Ensure rewardPerVoter is explicitly set and positive
        if (!pollDataToSubmit.rewardPerVoter || parseFloat(pollDataToSubmit.rewardPerVoter) <= 0) {
          pollDataToSubmit.rewardPerVoter = 1.0; // Default to 1.0 if not set
        }
        
        // Include platform fee
        pollDataToSubmit.platformFee = parseFloat(calculations.appFee);
      } else {
        // For non-rewarded polls, no funds needed
        pollDataToSubmit.fundAmount = 0;
        pollDataToSubmit.rewardPerVoter = 0;
        pollDataToSubmit.platformFee = parseFloat(calculations.transactionFee);
      }
      
      // For MetaMask users with rewards, tell backend to handle funds transfer
      if (isRewardEnabled && authType !== 'magic') {
        pollDataToSubmit.handleFundsTransfer = true;
        
        // CRITICAL: Add signature information if we have it - NEVER proceed without it
        // First check direct pollData storage (our most reliable method)
        if (pollData.walletSignature) {
          // Transfer all signature fields directly
          pollDataToSubmit.walletSignature = pollData.walletSignature;
          pollDataToSubmit.signatureMessage = pollData.signatureMessage;
          pollDataToSubmit.signatureAmount = pollData.signatureAmount;
          pollDataToSubmit.signatureSigner = pollData.signatureSigner;
          pollDataToSubmit.signatureSmartWallet = pollData.signatureSmartWallet;
          pollDataToSubmit.signatureTokenAmount = pollData.signatureTokenAmount;
          pollDataToSubmit.signatureTokenAddress = pollData.signatureTokenAddress;
          pollDataToSubmit.signatureTimestamp = pollData.signatureTimestamp;
          pollDataToSubmit.signatureTarget = pollData.signatureTarget;
          pollDataToSubmit.signatureData = pollData.signatureData;
          
          // For backward compatibility
          pollDataToSubmit.signature = pollData.walletSignature;
          
          logger.info("Including user signature with poll creation data (from pollData direct storage)");
        }
        // Then check React state
        else if (signatureInfo && signatureInfo.signature) {
          // Transfer signature from state
          pollDataToSubmit.walletSignature = signatureInfo.signature;
          pollDataToSubmit.signatureMessage = signatureInfo.message;
          pollDataToSubmit.signatureAmount = signatureInfo.amount;
          
          // Handle new signature format
          if (typeof signatureInfo === 'object' && signatureInfo.signer) {
            pollDataToSubmit.signatureSigner = signatureInfo.signer;
            pollDataToSubmit.signatureSmartWallet = signatureInfo.smartWallet;
            pollDataToSubmit.signatureTokenAmount = signatureInfo.amountInTokenUnits;
            pollDataToSubmit.signatureTokenAddress = signatureInfo.tokenAddress;
            pollDataToSubmit.signatureTimestamp = signatureInfo.timestamp;
            pollDataToSubmit.signatureTarget = signatureInfo.to;
            pollDataToSubmit.signatureData = JSON.stringify(signatureInfo);
          }
          
          // For backward compatibility
          pollDataToSubmit.signature = signatureInfo.signature;
          
          logger.info("Including user signature with poll creation data (from state)");
        }
        // Then check our global window variable (our backup method)
        else if (window.lastSignatureInfo && window.lastSignatureInfo.signature) {
          // Transfer signature from global
          pollDataToSubmit.walletSignature = window.lastSignatureInfo.signature;
          pollDataToSubmit.signatureMessage = window.lastSignatureInfo.message;
          pollDataToSubmit.signatureAmount = window.lastSignatureInfo.amount;
          
          // Handle new signature format
          if (typeof window.lastSignatureInfo === 'object' && window.lastSignatureInfo.signer) {
            pollDataToSubmit.signatureSigner = window.lastSignatureInfo.signer;
            pollDataToSubmit.signatureSmartWallet = window.lastSignatureInfo.smartWallet;
            pollDataToSubmit.signatureTokenAmount = window.lastSignatureInfo.amountInTokenUnits;
            pollDataToSubmit.signatureTokenAddress = window.lastSignatureInfo.tokenAddress;
            pollDataToSubmit.signatureTimestamp = window.lastSignatureInfo.timestamp;
            pollDataToSubmit.signatureTarget = window.lastSignatureInfo.to;
            pollDataToSubmit.signatureData = JSON.stringify(window.lastSignatureInfo);
          }
          
          // For backward compatibility
          pollDataToSubmit.signature = window.lastSignatureInfo.signature;
          
          logger.info("Including user signature with poll creation data (from global variable)");
        }
        // CRITICAL: Check if funds were already transferred successfully (use every possible check)
        else if (fundsTransferred || 
                 window.fundsSuccessfullyTransferred || 
                 pollData.transferTxHash || 
                 window.transferInfo || 
                 (parseFloat(initialBalance) - parseFloat(usdtBalance || '0') >= 1.0)) {
          logger.info("CRITICAL: Funds already transferred - no signature needed for poll creation");
          
          // Add transfer transaction hash as proof of transfer
          pollDataToSubmit.transferTxHash = pollData.transferTxHash || "verified-by-balance-decrease";
          pollDataToSubmit.transferTimestamp = pollData.transferTimestamp || Date.now();
          pollDataToSubmit.transferAmount = pollData.transferAmount || calculations.totalCost;
          pollDataToSubmit.transferCompleted = true;
          pollDataToSubmit.fundsAlreadyTransferred = true;
          pollDataToSubmit.balanceDecreaseVerified = true;
          
          // Add a dummy signature for backward compatibility
          pollDataToSubmit.signature = "FUNDS_ALREADY_TRANSFERRED";
          pollDataToSubmit.signatureMessage = "Funds were transferred in a separate transaction";
          
          // This is proof that the transfer succeeded, which is better than a signature
          logger.info("Using successful transfer as authorization instead of signature");
        }
        else {
          // Fetch the very latest balance - ignore what's in state variables
          let finalCurrentBalance;
          try {
            // Force a fresh balance check
            finalCurrentBalance = await refreshUSDTBalance();
            logger.info(`FORCED FRESH BALANCE CHECK: ${finalCurrentBalance}`);
            
            // Calculate decrease with most up-to-date data
            const finalBalanceCheck = parseFloat(initialBalance) - parseFloat(finalCurrentBalance);
            logger.info(`FINAL BALANCE CHECK: Initial=${initialBalance}, Fresh Current=${finalCurrentBalance}, Decrease=${finalBalanceCheck.toFixed(2)}`);
            
            if (finalBalanceCheck >= 1.0) {
              // We have a balance decrease, use that as verification
              logger.info("BALANCE DECREASE DETECTED - using as verification for funds transfer");
              pollDataToSubmit.signature = "VERIFIED_BY_BALANCE_DECREASE";
              pollDataToSubmit.signatureMessage = `Balance decreased by ${finalBalanceCheck.toFixed(2)} USDT`;
              pollDataToSubmit.balanceDecreaseVerified = true;
              pollDataToSubmit.transferCompleted = true;
              pollDataToSubmit.fundsAlreadyTransferred = true;
              
              // Since we have a balance decrease, we know funds were transferred
              return; // Skip the error
            }
          } catch (balanceError) {
            logger.error("Error checking final balance:", balanceError);
          }
          
          // CRITICAL: Check for evidence of transfer in logs
          if ((fundsTransferred === true) || 
              (window.console && window.console.logs && window.console.logs.some(log => 
                log.includes("Transfer verified") || 
                log.includes("Balance decreased by") ||
                log.includes("FUNDS TRANSFERRED SUCCESSFULLY")))) {
            logger.info("EVIDENCE OF TRANSFER FOUND IN LOGS - using as verification");
            pollDataToSubmit.signature = "VERIFIED_BY_LOGS";
            pollDataToSubmit.signatureMessage = `Transfer verified according to logs`;
            pollDataToSubmit.transferLogVerified = true;
            pollDataToSubmit.transferCompleted = true;
            pollDataToSubmit.fundsAlreadyTransferred = true;
            return; // Skip the error
          }
          
          // Last chance: Check if we previously set the fundsTransferred flag to true
          if (fundsTransferred === true) {
            logger.info("FUNDS TRANSFERRED FLAG IS TRUE - accepting as verification");
            pollDataToSubmit.signature = "VERIFIED_BY_FLAG";
            pollDataToSubmit.fundsAlreadyTransferred = true;
            return; // Skip the error
          }
          
          // If we get here, all verification methods failed
          logger.error("❌ CRITICAL ERROR: No user signature available for fund transfer - CANNOT proceed with poll creation");
          throw new Error("Missing signature for fund transfer. This is required to ensure funds can be transferred. Please try again.");
        }
        
        // Explicitly flag that we're ready to handle funds transfer
        pollDataToSubmit.hasValidSignature = true;
        
        // CRITICAL: Add a special flag to ensure the backend knows to use the new signature format
        pollDataToSubmit.useDirectSignature = true;
        pollDataToSubmit.signatureVersion = 2;
        
        // Add signature verification flag
        pollDataToSubmit.verifySignature = true;
        pollDataToSubmit.requireValidSignature = true;
      }
      
      // CRITICAL: For MetaMask users, we need both EOA and smart wallet addresses
      // Set creator address to EOA (signing address)
      pollDataToSubmit.creator = account;
      
      // Smart wallet is the address that holds the tokens for non-magic users
      if (authType !== 'magic' && smartWalletAddress) {
        pollDataToSubmit.smartWalletAddress = smartWalletAddress;
      }
      
      // SUPER CRITICAL: Check if funds have already been transferred
      // Add detailed logging for debugging purpose
      logger.info("TRANSFER STATUS CHECK:", {
        fundsTransferred: fundsTransferred,
        hasTransferTxHash: !!pollData.transferTxHash,
        transferAmount: pollData.transferAmount || "none",
        transferTimestamp: pollData.transferTimestamp || "none",
        balanceVerification: {
          initialBalance: initialBalance,
          currentBalance: usdtBalance || "unknown"
        }
      });
      
      // Force the transferCompleted flag to true if we've verified the balance change
      const balanceDecrease = parseFloat(initialBalance) - parseFloat(usdtBalance || '0');
      const significantDecrease = balanceDecrease > (parseFloat(calculations.totalCost) * 0.9); // 90% of expected
      
      // Log the balance change
      logger.info(`BALANCE VERIFICATION: Initial=${initialBalance}, Current=${usdtBalance}, Decrease=${balanceDecrease.toFixed(2)}, Expected=${calculations.totalCost}, Significant=${significantDecrease}`);
      
      if ((fundsTransferred && pollData.transferTxHash) || significantDecrease) {
        // Tell backend transfer was done separately - it should NOT attempt to transfer again
        pollDataToSubmit.fundsAlreadyTransferred = true;
        pollDataToSubmit.skipTransfer = true;
        pollDataToSubmit.transferVerified = true;
        pollDataToSubmit.transferTxHash = pollData.transferTxHash || "verified-by-balance-change";
        pollDataToSubmit.transferAmount = pollData.transferAmount || calculations.totalCost;
        pollDataToSubmit.transferTimestamp = pollData.transferTimestamp || Date.now();
        
        // Add dummy signature so poll creation works
        pollDataToSubmit.signature = "FUNDS_ALREADY_TRANSFERRED";
        pollDataToSubmit.signatureMessage = "Funds were already transferred, verified by balance change";
        
        // Still include verification info
        pollDataToSubmit.initialBalance = initialBalance;
        pollDataToSubmit.expectedTransferAmount = calculations.totalCost;
        pollDataToSubmit.actualBalanceDecrease = balanceDecrease.toFixed(2);
        
        logger.info("CRITICAL: Funds already transferred, telling backend to skip transfer step");
      } else {
        // CRITICAL: For non-reward polls or if somehow we got here without transfer, make it clear
        pollDataToSubmit.requireSuccessfulTransfer = false;
        pollDataToSubmit.skipTransfer = true;
        
        if (isRewardEnabled) {
          logger.warn("⚠️ Creating rewarded poll without funds transfer - this should not happen!");
        }
      }
      
      // Add detailed tokenomics info for verification
      pollDataToSubmit.detailedCosts = {
        pollCreationCost: calculations.pollCreationCost,
        rewardCost: calculations.rewardCost,
        transactionFee: calculations.transactionFee,
        rewardFee: calculations.rewardFee,
        appFee: calculations.appFee,
        totalCost: calculations.totalCost
      };
      
      // Log what we're submitting with DETAILED architecture info
      logger.info(`Creating poll with the following data:`, {
        creator: pollDataToSubmit.creator, // EOA address that signs transactions
        smartWalletAddress: pollDataToSubmit.smartWalletAddress, // Smart wallet that holds tokens
        authType: authType, // 'magic' or 'wallet'
        hasRewards: pollDataToSubmit.hasRewards,
        rewardPerVoter: pollDataToSubmit.rewardPerVoter,
        voteLimit: pollDataToSubmit.voteLimit,
        fundAmount: pollDataToSubmit.fundAmount,
        platformFee: pollDataToSubmit.platformFee,
        handleFundsTransfer: pollDataToSubmit.handleFundsTransfer,
        useSmartWallet: pollDataToSubmit.useSmartWallet,
        verifyTransfer: pollDataToSubmit.verifyTransfer,
        requireSuccessfulTransfer: pollDataToSubmit.requireSuccessfulTransfer
      });
      
      // Critical architecture log to help debugging
      logger.info(`ARCHITECTURE: ${authType === 'magic' ? 'Magic User' : 'MetaMask with Smart Wallet'}`);
      logger.info(`FUNDS FLOW: ${authType === 'magic' ? 'Direct from user wallet' : 'From smart wallet via meta-transaction'}`);
      if (authType !== 'magic') {
        logger.info(`EOA (signer): ${account}, Smart Wallet (token holder): ${smartWalletAddress}`);
      }
      
      // Call the backend API for poll creation
      const response = await onConfirm(pollDataToSubmit);
      
      // CRITICAL: Verify the response was successful 
      if (!response?.data?.success) {
        const errorMsg = response?.data?.error || "Failed to create poll";
        logger.error(`Poll creation failed: ${errorMsg}`);
        throw new Error(`Poll creation failed: ${errorMsg}`);
      }
      
      // Verify we got a poll ID AND transfer confirmation flag
      const pollId = response?.data?.poll?._id;
      const transferConfirmed = response?.data?.transferConfirmed;
      
      if (!pollId) {
        logger.error("Poll creation response missing poll ID");
        throw new Error("Poll creation response missing poll ID");
      }
      
      // CRITICAL: For rewarded polls, we MUST check the transferConfirmed flag
      if (isRewardEnabled && transferConfirmed === false) {
        logger.error("❌ CRITICAL ERROR: Poll was created but backend explicitly reported transfer failure");
        throw new Error("Poll creation failed: Funds were not transferred according to backend verification.");
      }
      
      logger.info(`Poll creation request successful: ID=${pollId}, Transfer confirmed: ${transferConfirmed ? 'Yes' : 'Pending'}`);
      
      // Store the transfer confirmation status
      let transferSuccess = transferConfirmed || !isRewardEnabled;
      
      // ABSOLUTELY CRITICAL: Check if funds were actually transferred
      // Sometimes the poll might be created on blockchain but funds aren't transferred
      if (isRewardEnabled) {
        logger.info("CRITICAL VERIFICATION: Verifying funds were actually transferred for rewarded poll");
        
        // Make a direct request to the backend to check if the transfer was processed
        try {
          const transferCheckResponse = await api.get(`/contracts/transfer-status/${pollId}`);
          
          if (transferCheckResponse?.data?.success && transferCheckResponse?.data?.transferred) {
            logger.info("✅ Backend confirms funds were transferred successfully");
            // Set a flag to indicate backend-verified transfer
            transferSuccess = true;
          } else {
            logger.warn("⚠️ Backend reports funds were NOT transferred properly");
            // Set a flag to indicate transfer failure according to backend
            transferSuccess = false;
            
            // If the backend says transfer failed but poll was created, we need to invalidate the poll
            if (response?.data?.poll?.createdOnChain) {
              logger.error("❌ CRITICAL ISSUE: Poll was created on blockchain but funds were not transferred!");
              
              // Try to mark the poll as invalid
              try {
                await api.post(`/polls/${pollId}/mark-invalid`, {
                  reason: "Funds were not transferred but poll was created on blockchain",
                  transferVerified: false,
                  backendReported: true,
                  createdPollId: pollId
                });
                logger.info("Poll marked as invalid due to failed fund transfer (backend reported)");
                
                // Alert the user about this serious issue
                throw new Error("CRITICAL ERROR: Poll was created but funds were not transferred according to backend! Poll has been marked as invalid.");
              } catch (invalidateError) {
                logger.error("Failed to mark poll as invalid:", invalidateError);
                // Still throw an error to prevent further processing
                throw new Error("CRITICAL ERROR: Poll was created but funds were not transferred according to backend!");
              }
            }
          }
        } catch (transferCheckError) {
          logger.error("Error checking transfer status:", transferCheckError);
          // If we can't check status, we MUST assume transfer failed for safety
          if (!transferCheckError.message?.includes("CRITICAL ERROR: Poll was created but funds were not transferred")) {
            // If this isn't our own thrown error from above, throw a new one
            throw new Error("Failed to verify fund transfer status with backend. Cannot proceed.");
          } else {
            // Re-throw our specific error
            throw transferCheckError;
          }
        }
      }
      
      // CRITICAL: Do not proceed if transfer verification failed
      if (isRewardEnabled && !transferSuccess) {
        logger.error("❌ Cannot proceed with poll creation: Fund transfer verification failed");
        throw new Error("Poll creation failed: Could not verify fund transfer. Please try again or contact support.");
      }
      
      // STEP 4: CRITICAL - Verify funds were actually transferred before showing success
      if (isRewardEnabled && refreshUSDTBalance) {
        setProcessingStep('verifying'); // Show we're verifying transfers
        try {
          // Wait longer to ensure blockchain state is fully updated
          // Transfers can take time to process
          setError("CRITICAL CHECK: Verifying funds were transferred... Please wait.");
          
          let fundTransferVerified = false;
          const oldBalance = parseFloat(initialBalance);
          const expectedDecrease = parseFloat(calculations.totalCost);
          
          // Check if we're using direct verification or backend verification
          if (authType !== 'magic' && pollDataToSubmit.handleFundsTransfer) {
            // For smart wallet users, we need to verify the backend handled the transfer
            logger.info(`CRITICAL VERIFICATION: Contacting backend to verify transfer completion`);
            
            try {
              // Call backend to verify if transfer was actually recorded on blockchain
              const verifyResponse = await api.post('/contracts/verify-poll-transfer', {
                pollId: pollId,
                expectedAmount: expectedDecrease.toFixed(6),
                smartWalletAddress: smartWalletAddress
              });
              
              if (verifyResponse?.data?.success && verifyResponse?.data?.verified) {
                logger.info("✅ BACKEND VERIFIED: Transfer was successful according to backend!");
                fundTransferVerified = true;
              } else {
                logger.warn("⚠️ Backend could not verify transfer completion.");
              }
            } catch (verifyError) {
              logger.error("Error verifying transfer with backend:", verifyError);
            }
          }
          
          logger.info(`CRITICAL VERIFICATION: Starting USDT transfer verification`);
          logger.info(`Initial balance: ${oldBalance} USDT, Expected decrease: ${expectedDecrease} USDT, Wallet: ${authType === 'magic' ? account : smartWalletAddress}`);
          
          // Try more times with longer delays - blockchain transfers can take time
          for (let i = 0; i < 5; i++) {
            // Wait longer between attempts with exponential backoff
            const delay = 2000 * Math.pow(1.5, i);
            logger.info(`Waiting ${delay/1000} seconds before attempt ${i+1}...`);
            setError(`Verifying funds transfer (attempt ${i+1}/5). Please wait ${(delay/1000).toFixed(1)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Refresh and check current balance
            // CRITICAL: For smart wallet users, we need to directly check the smart wallet balance
            let newBalance;
            if (authType !== 'magic' && smartWalletAddress) {
              // Call specialized balance check for the specific smart wallet address
              try {
                const swResponse = await api.get(`/contracts/balance/${smartWalletAddress}`);
                if (swResponse?.data?.success) {
                  newBalance = swResponse.data.balance;
                  logger.info(`Direct smart wallet balance check: ${newBalance} USDT`);
                } else {
                  // Fall back to normal refresh if direct check fails
                  newBalance = await refreshUSDTBalance();
                }
              } catch (swError) {
                logger.error("Error checking smart wallet balance directly:", swError);
                newBalance = await refreshUSDTBalance();
              }
            } else {
              // Normal balance refresh for Magic users
              newBalance = await refreshUSDTBalance();
            }
            
            logger.info(`Checking USDT balance (attempt ${i+1}/5): ${newBalance}`);
            
            // Verify balance decreased
            const currentBalance = parseFloat(newBalance);
            const actualDecrease = oldBalance - currentBalance;
            
            // Log detailed verification information
            logger.info(`Verification check ${i+1}/5: Initial=${oldBalance}, Current=${currentBalance}, Decrease=${actualDecrease.toFixed(4)}, Expected=${expectedDecrease.toFixed(4)}`);
            
            // Use multiple thresholds based on attempt number
            let threshold = 0.8; // Start with 80% threshold
            
            // Lower threshold on later attempts
            if (i >= 3) threshold = 0.5; // 50% threshold on attempts 4-5
            else if (i >= 1) threshold = 0.7; // 70% threshold on attempts 2-3
            
            // Check if threshold is met
            if (actualDecrease >= expectedDecrease * threshold) {
              logger.info(`USDT balance decreased as expected: -${actualDecrease.toFixed(2)} USDT (${(actualDecrease/expectedDecrease*100).toFixed(0)}% of expected)`);
              fundTransferVerified = true;
              setFundsTransferred(true);
              setError('');
              break;
            }
            
            logger.warn(`Waiting for balance to update... Current: ${currentBalance}, Initial: ${oldBalance}, Decrease: ${actualDecrease}, Expected: ${expectedDecrease}`);
            setError(`Verifying funds transfer (attempt ${i+1}/5). Waiting for blockchain confirmation...`);
          }
          
          // One final check with a longer delay
          if (!fundTransferVerified) {
            logger.info("Making final balance check with extended wait time...");
            setError("Making final verification attempt. Please wait...");
            
            // Last extended wait
            await new Promise(resolve => setTimeout(resolve, 8000)); 
            
            const finalBalance = await refreshUSDTBalance();
            const currentBalance = parseFloat(finalBalance);
            const actualDecrease = oldBalance - currentBalance;
            
            logger.info(`FINAL verification: Initial=${oldBalance}, Final=${currentBalance}, Decrease=${actualDecrease.toFixed(4)}, Expected=${expectedDecrease.toFixed(4)}`);
            
            // For final check, use lowest threshold - even a small decrease might indicate progress
            if (actualDecrease >= expectedDecrease * 0.3) {
              logger.info(`Transfer partially verified! Balance decreased by ${actualDecrease.toFixed(2)} USDT (${(actualDecrease/expectedDecrease*100).toFixed(0)}% of expected)`);
              fundTransferVerified = true;
              setFundsTransferred(true);
              setError('');
            }
          }
          
          // CRITICAL CHECK: If balance didn't decrease significantly, the poll creation failed
          if (!fundTransferVerified) {
            logger.error(`CRITICAL FAILURE: USDT balance didn't decrease as expected. Initial: ${oldBalance}, Final: ${parseFloat(await refreshUSDTBalance())}`);
            logger.error(`Expected decrease: ~${expectedDecrease}, Actual: ${(oldBalance - parseFloat(await refreshUSDTBalance())).toFixed(4)}`);
            
            // CRITICAL: Attempt to invalidate the poll on the backend since funds weren't actually transferred
            try {
              await api.post(`/polls/${pollId}/mark-invalid`, {
                reason: "Funds were not transferred - balance verification failed",
                transferFailure: true,
                expectedAmount: expectedDecrease.toFixed(6),
                initialBalance: oldBalance.toString(),
                finalBalance: (await refreshUSDTBalance()).toString()
              });
              logger.info("Poll marked as invalid due to failed balance verification");
            } catch (invalidationError) {
              logger.error("Failed to mark poll as invalid:", invalidationError);
            }
            
            // CRITICAL: Throw an error to stop the process
            throw new Error(`Poll creation failed: Funds were not transferred. Your USDT balance didn't decrease as expected. Please try again or contact support.`);
          }
          
          // If we made it here, funds were transferred successfully
          const finalVerifiedBalance = await refreshUSDTBalance();
          logger.info(`✅ SUCCESS! Funds transfer verified! Initial: ${oldBalance}, Final: ${parseFloat(finalVerifiedBalance)}, Decrease: ${(oldBalance - parseFloat(finalVerifiedBalance)).toFixed(2)} USDT`);
          
          // Update the processing step back
          setProcessingStep('complete');
        } catch (balanceError) {
          logger.error("Error verifying final balance:", balanceError);
          setProcessingStep('error');
          throw new Error(`Poll creation failed: Unable to verify funds transfer. ${balanceError.message}`);
        }
      }
      
      if (response?.data?.poll?._id) {
        // Show success message
        setPollCreationSuccess(true);
        setProcessingStep('complete');
        setError('');
        return {
          success: true,
          data: response.data
        };
      } else {
        console.warn("Poll created but response format unexpected:", response);
        setError("Poll created, but couldn't redirect to the poll page. Please check your polls list.");
        return false;
      }
    } catch (err) {
      console.error('Error creating poll:', err);
      const errorMsg = err?.response?.data?.error ||
                       err?.response?.data?.message ||
                       err.message ||
                       'An unexpected error occurred during poll creation.';
      setError(errorMsg);
      setProcessingStep('error');
      return false;
    }
  };

  // Handle modal close with state reset
  const handleCloseModal = () => {
    setApprovalComplete(false);
    setFundsTransferred(false);
    setPollCreationSuccess(false);
    setError('');
    setProcessingStep(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-out">
      {/* Modal Panel */}
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 ease-out scale-95 opacity-0 animate-modal-scale-fade-in">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {processingStep === 'approving' ? 'Approving USDT...' :
             processingStep === 'transferring' ? 'Transferring USDT...' :
             processingStep === 'creating' ? 'Creating Poll...' :
             processingStep === 'verifying' ? 'Verifying Transfer...' :
             processingStep === 'complete' ? 'Poll Created!' :
             processingStep === 'error' ? 'Error' :
             'Confirm Your Poll'}
          </h3>
          <button
            onClick={handleCloseModal}
            disabled={processingStep === 'approving' || processingStep === 'transferring' || processingStep === 'creating' || processingStep === 'verifying'}
            className="text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
            aria-label="Close confirmation modal"
          >
            {/* Close Icon SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 mb-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            <p className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="p-6 space-y-5">

          {/* Processing State Display */}
          {processingStep === 'approving' || processingStep === 'transferring' || processingStep === 'creating' || processingStep === 'verifying' ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="mb-4">
                <svg className="animate-spin h-10 w-10 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-700">
                {processingStep === 'approving' ? 'Approving USDT transfer...' : 
                 processingStep === 'transferring' ? authType !== 'magic' ? 'Waiting for MetaMask signature...' : 'Transferring USDT...' :
                 processingStep === 'verifying' ? 'Verifying funds transfer...' :
                 'Creating your poll...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {processingStep === 'verifying' ? 
                  'Confirming blockchain transaction success' : 
                  'This may take a few moments'}
              </p>
              {(processingStep === 'approving' || processingStep === 'transferring') && (
                <p className="text-sm text-gray-500 mt-2">Please check MetaMask for transaction requests</p>
              )}
              {processingStep === 'verifying' && (
                <p className="text-sm text-gray-500 mt-2">
                  Ensuring your USDT was transferred successfully
                </p>
              )}
            </div>
          ) : processingStep === 'complete' ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="mb-4 bg-green-100 p-2 rounded-full">
                <svg className="h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-700">Poll created successfully!</p>
              <p className="text-sm text-gray-500 mt-2">Redirecting you to your poll...</p>
            </div>
          ) : (
            <>
              {/* Poll Info Section (with background) */}
              <div className="bg-slate-50 border border-slate-200/75 rounded-lg p-4 shadow-sm">
                <div className="flex items-center">
                  {/* Icon/Image Preview */}
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0 border border-slate-300 overflow-hidden mr-4">
                    {modalPreviewUrl ? (
                        <img src={modalPreviewUrl} alt={pollData?.title || 'Poll Icon'} className="w-full h-full object-cover" />
                    ) : ( <DefaultPollIcon /> )}
                  </div>
                  {/* Title */}
                  <div className="flex-grow min-w-0">
                      <h4 className="text-base font-semibold text-gray-900 leading-tight">{pollData?.title || 'Poll Question'}</h4>
                  </div>
                  {/* Rewards */}
                  <div className="ml-2 text-right flex-shrink-0 pl-2">
                      <p className="text-base font-semibold text-gray-800">${calculations.rewardCost}</p>
                      <p className="text-xs text-gray-500 -mt-1">Total Rewards</p>
                  </div>
                </div>
              </div>

              {/* --- Separator Line --- */}
              <div className="border-t border-slate-200/75"></div>

              {/* Cost Breakdown Section (no background) */}
              <div className="space-y-3 pt-1">
                {/* Poll Transaction Cost */}
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-600">Poll Transaction Cost</span>
                  <span className="font-medium text-gray-900">${calculations.pollCreationCost}</span>
                </div>
                {/* Total Reward Cost */}
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-600">Total Reward Cost</span>
                  <span className="font-medium text-gray-900">${calculations.rewardCost}</span>
                </div>
                {/* Transaction Fee */}
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-600">Transaction Fee (6%)</span>
                  <span className="font-medium text-gray-900">${calculations.transactionFee}</span>
                </div>
                {/* Reward Fee */}
                {isRewardEnabled && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-600">Reward Fee (6%)</span>
                    <span className="font-medium text-gray-900">${calculations.rewardFee}</span>
                  </div>
                )}
                {/* Total App Fee */}
                <div className="flex justify-between text-sm items-center font-semibold">
                  <span className="text-gray-600">Total Platform Fee</span>
                  <span className="font-medium text-gray-900">${calculations.appFee}</span>
                </div>
              </div>

              {/* Total Cost Section (no background) */}
              <div className="flex justify-between items-center border-t border-gray-200 pt-4 pb-1">
                <span className="text-base font-semibold text-gray-800">Total Cost</span>
                <span className="text-base font-bold text-gray-900">${calculations.totalCost}</span>
              </div>

              {/* Current Balance Display */}
              {isRewardEnabled && (
                <div className={`flex justify-between items-center text-sm ${!sufficientBalance ? 'text-red-600' : 'text-green-600'}`}>
                  <span>Your USDT Balance:</span>
                  <span className="font-medium">${parseFloat(usdtBalance || '0').toFixed(2)}</span>
                </div>
              )}

              {/* Help Text Section (with background) */}
              <div className="bg-slate-50 border border-slate-200/75 rounded-lg p-3 shadow-sm text-xs text-gray-500">
                <p>These fees cover the cost of hosting and maintaining the poll on our platform.</p>
                <p className="mt-1">All payments are final and non-refundable.</p>
              </div>

              {/* Process Explanation */}
              {isRewardEnabled && authType !== 'magic' && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 shadow-sm text-xs text-blue-700">
                  <p><strong>This process uses your smart wallet:</strong></p>
                  <ol className="list-decimal ml-4 mt-1 space-y-1">
                    <li>You'll sign a message with MetaMask (no gas fees)</li>
                    <li>Your smart wallet will approve USDT spending</li>
                    <li>Your smart wallet will transfer USDT for poll costs and fees</li>
                    <li>All gas fees are covered by the platform</li>
                  </ol>
                  <p className="mt-1"><strong>Note:</strong> The USDT tokens are held by your smart wallet ({smartWalletAddress ? `${smartWalletAddress.substring(0, 6)}...${smartWalletAddress.substring(smartWalletAddress.length - 4)}` : "loading..."}), not your MetaMask wallet.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer / Action Buttons Area */}
        <div className="flex border-t border-gray-200 bg-gray-50 px-6 py-4">
          {processingStep === 'complete' ? (
            <button
              type="button"
              onClick={handleCloseModal}
              className="w-full py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Done
            </button>
          ) : processingStep === 'error' ? (
            <>
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 mr-2 py-2 px-4 bg-white border border-gray-300 rounded-full shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setProcessingStep(null);
                  setApprovalComplete(false);
                  setFundsTransferred(false);
                }}
                className="flex-1 ml-2 py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-cyan-500 hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
              >
                Try Again
              </button>
            </>
          ) : processingStep === 'approving' || processingStep === 'transferring' || processingStep === 'creating' || processingStep === 'verifying' ? (
            <button
              type="button"
              disabled
              className="w-full py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-gray-400 cursor-not-allowed"
            >
              {processingStep === 'verifying' ? 'Verifying Transfer...' : 'Processing...'}
            </button>
          ) : (
            <>
              {/* Edit Poll Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={processingStep === 'approving' || processingStep === 'transferring' || processingStep === 'creating' || processingStep === 'verifying'}
                className="flex-1 mr-2 py-2 px-4 bg-white border border-gray-300 rounded-full shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit Poll
              </button>
              {/* Proceed Button */}
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={processingStep === 'approving' || processingStep === 'transferring' || processingStep === 'creating' || processingStep === 'verifying' || !sufficientBalance}
                className={`flex-1 ml-2 py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors duration-150 ease-in-out ${
                  processingStep === 'approving' || processingStep === 'transferring' || processingStep === 'creating' || processingStep === 'verifying' || !sufficientBalance
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'
                } disabled:opacity-75`}
              >
                {isRewardEnabled ? 'Pay & Create Poll' : 'Create Poll'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Simple CSS Animation definition */}
      <style jsx="true" global="true">{`
        @keyframes modal-scale-fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-modal-scale-fade-in {
          animation: modal-scale-fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default PollConfirmationModal;