// src/pages/PollDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';

const PollDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Get data from context using the unified hook
  const {
    isConnected,
    account,
    authType,
    openAuthModal,
    userProfile, // Assuming userProfile might be used later
    getPoll,
    votePoll,
    pollLoading, // Use this for voting loading state
    pollError    // Use this for voting errors
  } = useAppContext();

  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state for fetching the poll
  const [error, setError] = useState(null); // General error state for this component (voting, etc.)
  const [selectedOption, setSelectedOption] = useState(null);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [rewardReceived, setRewardReceived] = useState(false); // Track reward message display

  // Check if current user is creator
  const isCreator = poll?.creator?.toLowerCase() === account?.toLowerCase();

  // Fetch poll data
  useEffect(() => {
    const fetchPoll = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors
        const response = await getPoll(id); // Use context function
        setPoll(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching poll:', err);
        // Use the error message from the response if available, otherwise generic
        const fetchErrorMsg = err?.response?.data?.message || err.message || 'Failed to load poll';
        setError(fetchErrorMsg); // Set component-specific error state
        setLoading(false);
      }
    };

    fetchPoll();
  }, [id, getPoll]); // Dependency array includes getPoll from context

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'; // Handle cases where date might be null/undefined
    // Check for specific zero timestamp from contract if applicable
    if (dateString === '1970-01-01T00:00:00.000Z') return 'No end date';
    try {
        const date = new Date(dateString);
        // Check if date is valid after parsing
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        return date.toLocaleString();
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Invalid date';
    }
  };

  // Format address
  const formatAddress = (address) => {
    if (!address) return 'Unknown';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Format USDT amount (from contract, likely string or BigNumber)
    const formatUSDT = (amount) => {
        if (amount === undefined || amount === null) return '0.00';
        try {
            // Assuming amount is wei (string), convert to Ether/USDT
            // If your contract stores it differently (e.g., already formatted), adjust this
            // Example: If amount is already in USDT units (not wei)
             return parseFloat(amount).toFixed(2);

            // Example: If amount is in wei (needs ethers library)
            // import { ethers } from 'ethers';
            // return ethers.utils.formatUnits(amount, 6); // Assuming 6 decimals for USDT
        } catch (e) {
            console.error("Error formatting USDT:", amount, e);
            return 'N/A';
        }
    };


  // Check if user has voted (using combined logic)
  const hasUserVoted = () => {
    if (!poll || !account) return false;

    // 1. Check localStorage first (quickest check)
    try {
      const alreadyVotedPolls = JSON.parse(localStorage.getItem('alreadyVotedPolls') || '{}');
      if (alreadyVotedPolls[id]) {
        return true;
      }
    } catch (e) {
      console.error("LocalStorage read error:", e);
      // Proceed to check contract state even if localStorage fails
    }

    // 2. Check contract state (if available)
    // Ensure onChain data exists before accessing its properties
    if (poll.onChain) {
        // Direct check from contract state if available (most reliable)
        if (poll.onChain.hasVoted === true || poll.onChain.hasVotedAndRewarded === true) {
            return true;
        }
        // Fallback check if direct `hasVoted` isn't populated but results imply voting
        if (poll.onChain.userVote !== undefined && poll.onChain.userVote !== null && poll.onChain.userVote >= 0) { // Assuming 0 is a valid vote index
            return true;
        }
         // Check if the 'votes' mapping in Poll.sol indicates a vote (value > 0)
         // Note: This might be less common to expose directly if `hasVoted` is used.
         if (poll.onChain.votes !== undefined && poll.onChain.votes > 0) {
            return true;
        }
    }


    return false; // Default to not voted if no checks pass
  };

  // Handle vote error and track already voted polls in localStorage
  const handleVoteError = (err) => {
    console.error('Error voting:', err);
    const backendError = err?.response?.data?.message;
    const contractError = err?.data?.message || err.message; // Check both error structures

    let userFriendlyError = 'Failed to submit vote. Please try again.';

    // Prioritize backend error message if specific
    if (backendError?.includes('Already voted') || backendError?.includes('Creator cannot vote')) {
        userFriendlyError = backendError;
    }
    // Check contract errors for common revert reasons
    else if (contractError?.includes('Already voted') || contractError?.includes('Poll creator cannot vote') || contractError?.includes('Poll is not active')) {
         // Extract clearer message if possible, otherwise use a generic one based on content
         if (contractError.includes('Already voted')) userFriendlyError = 'You have already voted on this poll.';
         else if (contractError.includes('Poll creator cannot vote')) userFriendlyError = 'Poll creator cannot vote on their own poll.';
         else if (contractError.includes('Poll is not active')) userFriendlyError = 'This poll is no longer active.';
         else userFriendlyError = 'Transaction reverted by contract.'; // Generic contract error
    }
     // Handle insufficient funds specifically if possible (example check)
    else if (contractError?.includes('insufficient funds')) {
        userFriendlyError = 'Insufficient funds for transaction.';
    }


    // If it seems like an "already voted" error (from any source), update localStorage
    if (userFriendlyError.includes('Already voted') || userFriendlyError.includes('Creator cannot vote')) {
        try {
            const alreadyVotedPolls = JSON.parse(localStorage.getItem('alreadyVotedPolls') || '{}');
            alreadyVotedPolls[id] = true; // Mark as attempted/voted locally
            localStorage.setItem('alreadyVotedPolls', JSON.stringify(alreadyVotedPolls));
        } catch (e) {
            console.error("LocalStorage write error:", e);
        }
    }

    setError(userFriendlyError); // Set the determined error message
  };


  // Handle voting action
  const handleVote = async () => {
    if (!isConnected) {
      openAuthModal(); // Prompt login/connection
      return;
    }

    if (selectedOption === null) {
      setError('Please select an option first.');
      return;
    }

    // Re-check conditions just before submitting
    if (isCreator) {
      setError('Poll creator cannot vote on their own poll.');
      return;
    }
    if (!poll?.onChain?.isActive) {
        setError('This poll is no longer active.');
        return;
    }
     if (hasUserVoted()) { // Check again using the combined function
       setError('You have already voted on this poll.');
       return;
     }

    try {
      setError(null); // Clear previous errors
      setVoteSuccess(false); // Reset success state

      // Call the votePoll function from context (handles both wallet types)
      // pollLoading state should be managed within useAppContext during the votePoll call
      await votePoll(id, selectedOption);

      // --- Post-vote actions ---

      // 1. Record successful vote in localStorage immediately
      try {
        const alreadyVotedPolls = JSON.parse(localStorage.getItem('alreadyVotedPolls') || '{}');
        alreadyVotedPolls[id] = true;
        localStorage.setItem('alreadyVotedPolls', JSON.stringify(alreadyVotedPolls));
      } catch (e) {
        console.error("LocalStorage write error post-vote:", e);
      }

      // 2. Show success message
      setVoteSuccess(true);
      if (poll.onChain?.hasRewards) {
        setRewardReceived(true); // Flag that reward message should show
      }

       // 3. Refresh poll data slightly delayed to allow backend/chain update
       setTimeout(async () => {
           try {
               const response = await getPoll(id);
               setPoll(response.data);
           } catch (refreshErr) {
               console.error("Error refreshing poll data after vote:", refreshErr);
               // Optionally notify user that refresh failed but vote might be ok
           }
       }, 1500); // Delay 1.5 seconds

      // 4. Clear success message after a few seconds
      setTimeout(() => {
        setVoteSuccess(false);
        setRewardReceived(false);
      }, 5000); // Show success message longer

    } catch (err) {
      // Use the refined error handler
      handleVoteError(err);
    }
  };

  // Calculate percentage for option display
    const calculatePercentage = (optionIndex) => {
        // Ensure necessary data exists and totalVotes is positive
        if (!poll?.onChain?.results || !poll.onChain.totalVotes || poll.onChain.totalVotes <= 0) {
            return 0;
        }
        const votesForOption = poll.onChain.results[optionIndex] || 0;
        // Use Math.round for cleaner percentages
        return Math.round((votesForOption / poll.onChain.totalVotes) * 100);
    };


  // --- Render Logic ---

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-center items-center min-h-[300px]">
          {/* Enhanced loading spinner */}
           <svg className="animate-spin h-10 w-10 text-cyan-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
           <p className="ml-3 text-gray-600">Loading Poll Details...</p>
        </div>
      </div>
    );
  }

  // Display specific error if poll fetch failed entirely
  if (error && !poll) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md border border-red-200">
        <div className="text-center py-8">
            {/* Error Icon */}
            <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-red-800">Error Loading Poll</h3>
            <p className="mt-1 text-red-600">{error}</p>
            <button
              onClick={() => navigate('/polls')}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
            >
              View All Polls
            </button>
        </div>
      </div>
    );
  }

  // Handle case where poll data is somehow null after loading without error
  if (!poll) {
      // This case should ideally not be reached if error handling is correct
      return (
          <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md">
              <div className="text-center py-8">
                  <p className="text-gray-600">Poll data could not be retrieved.</p>
                  <button
                      onClick={() => navigate('/polls')}
                       className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                  >
                      View All Polls
                  </button>
              </div>
          </div>
      );
  }

  // Determine if user has voted based on combined checks
   const userHasVoted = hasUserVoted(); // Call the function once for efficiency

  // --- Main Poll Detail Render ---
  return (
    <div className="max-w-3xl mx-auto my-10 p-6 md:p-8 bg-white rounded-xl shadow-lg border border-gray-200/75">
      {/* Poll Header Section */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex justify-between items-start mb-3 flex-wrap gap-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mr-4">{poll.title}</h1>
          <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${
            poll.onChain?.isActive
              ? 'bg-green-100 text-green-800 ring-1 ring-green-200'
              : 'bg-red-100 text-red-800 ring-1 ring-red-200'
          }`}>
            {poll.onChain?.isActive ? 'Active' : 'Closed'}
          </span>
        </div>

        {poll.description && (
          <p className="text-gray-600 mb-4">{poll.description}</p>
        )}

        {/* ===> INSERTED IMAGE DISPLAY <=== */}
        {poll.image && (
           <div className="my-4"> {/* Add margin around image */}
               <img
                   src={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/images/${poll.image}`} // Added fallback URL for local dev
                   alt={`Visual for poll: ${poll.title}`} // More descriptive alt text
                   className="w-full h-64 object-cover rounded-lg shadow-md border border-gray-100" // Enhanced styling
                   onError={(e) => { e.target.style.display = 'none'; console.error("Failed to load image:", e.target.src); }} // Hide broken images
               />
           </div>
         )}
         {/* ===> END IMAGE DISPLAY <=== */}


        {/* Tags and Reward Info */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
            {poll.category || 'General'}
          </span>

          {poll.tags && poll.tags.map((tag, index) => (
            <span
              key={index}
              className="text-xs font-medium bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-full"
            >
              #{tag}
            </span>
          ))}

          {poll.onChain?.hasRewards && (
            <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full flex items-center">
              <svg className="w-3 h-3 mr-1 fill-current" viewBox="0 0 20 20"><path d="M10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-1.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0zm0 18.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17z"/></svg>
              Reward: {formatUSDT(poll.onChain?.rewardPerVoter)} USDT
            </span>
          )}
        </div>

        {/* Metadata: Creator, Dates, Votes */}
        <div className="text-sm text-gray-500 space-y-1">
          <div className="flex items-center">
            <span className="font-medium w-20 inline-block flex-shrink-0">Created by:</span>
            <span className="truncate" title={poll.creator}>{formatAddress(poll.creator)}</span>
            {isCreator && (
              <span className="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-medium">
                You
              </span>
            )}
          </div>

          <div className="flex items-center">
            <span className="font-medium w-20 inline-block flex-shrink-0">Created:</span>
            <span>{formatDate(poll.createdAt)}</span>
          </div>

          {poll.onChain?.endTime && poll.onChain.endTime !== '1970-01-01T00:00:00.000Z' && ( // Check for valid end time
            <div className="flex items-center">
              <span className="font-medium w-20 inline-block flex-shrink-0">Ends:</span>
              <span>{formatDate(poll.onChain.endTime)}</span>
            </div>
          )}

          {poll.onChain?.totalVotes !== undefined && (
            <div className="flex items-center">
              <span className="font-medium w-20 inline-block flex-shrink-0">Total votes:</span>
              <span>{poll.onChain.totalVotes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notification Area */}
       <div className="space-y-4 mb-6">
           {isCreator && poll.onChain?.isActive && (
             <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 rounded-r-md">
                 <p className="text-sm"><span className="font-medium">Note:</span> As the poll creator, you cannot vote.</p>
             </div>
           )}

           {!isConnected && poll.onChain?.isActive && (
             <div className="p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-700 rounded-r-md">
                 <p className="text-sm font-medium">Connect your wallet or sign in to vote.</p>
                 <button
                     onClick={openAuthModal}
                     className="mt-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold underline"
                 >
                     Sign In / Connect Wallet
                 </button>
             </div>
           )}

           {isConnected && userHasVoted && (
             <div className="p-4 bg-indigo-50 border-l-4 border-indigo-400 text-indigo-700 rounded-r-md">
                 <p className="text-sm font-medium">You have already cast your vote for this poll.</p>
                 {/* Optionally show reward confirmation if applicable and voted */}
                 {poll.onChain?.hasRewards && (
                     <p className="mt-1 text-sm">
                         Your reward of {formatUSDT(poll.onChain?.rewardPerVoter)} USDT should be reflected in your wallet.
                     </p>
                 )}
             </div>
           )}

           {/* Display component-level errors (voting errors, etc.) */}
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-md" role="alert">
                <p className="text-sm"><span className="font-medium">Error:</span> {error}</p>
              </div>
            )}

            {/* Display context-level poll errors (e.g., from votePoll if not caught locally) */}
            {pollError && !error && ( // Avoid showing duplicate errors
              <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-md" role="alert">
                <p className="text-sm"><span className="font-medium">Error:</span> {pollError}</p>
              </div>
            )}

           {voteSuccess && (
             <div className="p-4 bg-green-50 border-l-4 border-green-400 text-green-700 rounded-r-md" role="alert">
                 <p className="text-sm font-medium">Vote successfully submitted!</p>
                 {rewardReceived && poll.onChain?.hasRewards && (
                     <p className="mt-1 text-sm">Your reward of {formatUSDT(poll.onChain?.rewardPerVoter)} USDT has been sent.</p>
                 )}
             </div>
           )}

           {/* Show reward info prominently if rewards exist and poll is active */}
            {poll.onChain?.hasRewards && poll.onChain?.isActive && !userHasVoted && (
              <div className="p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-700 rounded-r-md">
                <h3 className="text-sm font-semibold flex items-center">
                  <svg className="w-4 h-4 mr-1.5 fill-current" viewBox="0 0 20 20"><path d="M10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-1.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0zm0 18.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17z"/></svg>
                  Reward Available!
                </h3>
                <p className="mt-1 text-sm">
                  Vote on this poll to instantly receive {formatUSDT(poll.onChain?.rewardPerVoter)} USDT in your connected wallet.
                </p>
              </div>
            )}
       </div>


      {/* Options / Voting Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Options</h2>

        <div className="space-y-4">
          {poll.options.map((option, index) => {
            const percentage = calculatePercentage(index);
            const isSelected = selectedOption === index;

            return (
              <div key={index}>
                 <label
                   htmlFor={`option-${index}`}
                   className={`block p-4 border rounded-lg cursor-pointer transition-all duration-150 ${
                     isSelected
                       ? 'bg-cyan-50 border-cyan-300 ring-2 ring-cyan-200'
                       : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                   } ${(!poll.onChain?.isActive || pollLoading || voteSuccess || isCreator || userHasVoted) ? 'opacity-70 cursor-not-allowed' : ''}`}
                 >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id={`option-${index}`}
                        name="poll-option"
                        value={index}
                        checked={isSelected}
                        onChange={() => setSelectedOption(index)}
                        className="h-4 w-4 text-cyan-600 border-gray-300 focus:ring-cyan-500 mr-3"
                        disabled={!poll.onChain?.isActive || pollLoading || voteSuccess || isCreator || userHasVoted}
                      />
                      <span className={`text-base font-medium ${isSelected ? 'text-cyan-900' : 'text-gray-800'}`}>
                        {option}
                      </span>
                    </div>
                    {/* Show votes/percentage only after voting or if poll is closed */}
                     {(userHasVoted || !poll.onChain?.isActive) && poll.onChain?.results && (
                       <span className="text-sm font-medium text-gray-500">
                         {poll.onChain.results[index] || 0} votes
                       </span>
                     )}
                  </div>

                  {/* Progress bar - show after voting or if poll is closed */}
                   {(userHasVoted || !poll.onChain?.isActive) && poll.onChain?.results && (
                    <div className="mt-2 flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-semibold text-cyan-800 w-8 text-right">{percentage}%</span>
                    </div>
                  )}
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Voting Button Area */}
       <div className="mt-8 flex justify-start">
           {/* Show Vote button only if poll is active, user is connected, not creator, and hasn't voted */}
           {poll.onChain?.isActive && isConnected && !isCreator && !userHasVoted && (
             <button
               onClick={handleVote}
               disabled={selectedOption === null || pollLoading || voteSuccess} // Disable while loading or after success
               className={`inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition duration-150 ease-in-out ${
                 (selectedOption === null || pollLoading || voteSuccess)
                   ? 'bg-gray-400 cursor-not-allowed'
                   : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 active:scale-[0.98]'
               }`}
             >
               {pollLoading ? (
                 <>
                   <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   Submitting Vote...
                 </>
               ) : voteSuccess ? (
                 'Vote Submitted!'
               ) : (
                 'Submit Vote'
               )}
             </button>
           )}

           {/* Message if button is hidden/disabled */}
            {(!poll.onChain?.isActive || isCreator || userHasVoted) && (
                 <p className="text-sm text-gray-500">
                     { !poll.onChain?.isActive ? "Voting is closed for this poll." :
                       isCreator ? "You cannot vote on your own poll." :
                       userHasVoted ? "You have already voted." : ""
                     }
                 </p>
            )}
       </div>


      {/* Footer Info */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-400 space-y-1">
          {poll.contractAddress && (
            <p>Contract: <span className="font-mono">{poll.contractAddress}</span></p>
           )}
           {authType && (
               <p>Connected via: <span className="font-medium">{authType === 'magic' ? 'Email (Magic)' : 'Wallet'}</span></p>
           )}
           <p>Poll ID: <span className="font-mono">{id}</span></p>
        </div>
      </div>
    </div>
  );
};

export default PollDetail;