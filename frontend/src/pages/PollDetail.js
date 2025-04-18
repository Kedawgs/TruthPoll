// src/pages/PollDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import { formatAddress, formatUSDT } from '../utils/web3Helper';

const PollDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Get data from context using the unified hook
  const {
    isConnected,
    account,
    authType,
    openAuthModal,
    getPoll,
    votePoll,
    pollLoading, // Use this for voting loading state
    pollError,   // Use this for voting errors
    usdtBalance, // Get USDT balance
    refreshUSDTBalance // Method to refresh USDT balance
  } = useAppContext();

  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state for fetching the poll
  const [error, setError] = useState(null); // General error state for this component (voting, etc.)
  const [selectedOption, setSelectedOption] = useState(null);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [rewardReceived, setRewardReceived] = useState(false); // Track reward message display
  const [rewardAmount, setRewardAmount] = useState(null); // Store reward amount for display

  // Check if current user is creator
  const isCreator = poll?.creator?.toLowerCase() === account?.toLowerCase();

  // Fetch poll data - UPDATED useEffect Hook
  useEffect(() => {
    const fetchPoll = async () => {
      try {
        // Reset component state when poll ID changes
        setLoading(true);
        setError(null);
        setSelectedOption(null); // Reset selected option from previous poll
        setVoteSuccess(false);   // Reset success message
        setRewardReceived(false);// Reset reward message
        // Note: Intentionally not resetting setPoll(null) here to avoid flicker if possible,
        // but you could add it if you prefer a blank slate while loading.

        const response = await getPoll(id);

        // Check if data was received (basic check)
        if (response.data) {
          setPoll(response.data);
          // Set reward amount from poll data if available
          if (response.data.onChain?.rewardPerVoter) {
            setRewardAmount(response.data.onChain.rewardPerVoter);
          }
        } else {
            // Handle case where API might return success but no data for the ID
            throw new Error("Poll data not found.");
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching poll:', err);
        const fetchErrorMsg = err?.response?.data?.message || err.message || 'Failed to load poll';
        setError(fetchErrorMsg);
        setPoll(null); // Ensure poll data is cleared on fetch error
        setLoading(false);
      }
    };

    // Re-fetch whenever ID changes and is valid
    if (id) { // Only fetch if ID exists
      fetchPoll();
    } else {
        // Handle case where ID might be missing from URL params
        setError("Poll ID is missing.");
        setLoading(false);
        setPoll(null);
    }

    // Cleanup function (optional but good practice)
    return () => {
      // Example: Could add logic here to cancel pending fetch requests
      // using AbortController if getPoll supports it.
    };
  }, [id, getPoll]); // Dependency array includes id and getPoll

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

  // Check if user has voted
  const hasUserVoted = () => {
    if (!poll || !account) return false;
    try {
      const alreadyVotedPolls = JSON.parse(localStorage.getItem('alreadyVotedPolls') || '{}');
      if (alreadyVotedPolls[id]) {
        return true;
      }
    } catch (e) { console.error("LocalStorage read error:", e); }
    if (poll.onChain) {
      if (poll.onChain.hasVoted === true || poll.onChain.hasVotedAndRewarded === true) return true;
      if (poll.onChain.userVote !== undefined && poll.onChain.userVote !== null && poll.onChain.userVote >= 0) return true;
      if (poll.onChain.votes !== undefined && poll.onChain.votes > 0) return true;
    }
    return false;
  };

  // Check if user has received rewards
  const hasReceivedReward = () => {
    if (!poll || !account) return false;
    if (poll.onChain && poll.onChain.hasVotedAndRewarded) return true;
    return false;
  };

  // Handle vote error
  const handleVoteError = (err) => {
    console.error('Error voting:', err);
    const backendError = err?.response?.data?.error;
    const contractError = err?.data?.message || err.message;
    let userFriendlyError = 'Failed to submit vote. Please try again.';
    if (backendError?.includes('Already voted') || backendError?.includes('Creator cannot vote')) { userFriendlyError = backendError; }
    else if (contractError?.includes('Already voted') || contractError?.includes('Poll creator cannot vote') || contractError?.includes('Poll is not active')) {
      if (contractError.includes('Already voted')) userFriendlyError = 'You have already voted on this poll.';
      else if (contractError.includes('Poll creator cannot vote')) userFriendlyError = 'Poll creator cannot vote on their own poll.';
      else if (contractError.includes('Poll is not active')) userFriendlyError = 'This poll is no longer active.';
      else userFriendlyError = 'Transaction reverted by contract.';
    } else if (contractError?.includes('insufficient funds')) { userFriendlyError = 'Insufficient funds for transaction.'; }
    else if (backendError?.includes('insufficient reward funds')) { userFriendlyError = backendError; }
    if (userFriendlyError.includes('Already voted') || userFriendlyError.includes('Creator cannot vote')) {
      try {
        const alreadyVotedPolls = JSON.parse(localStorage.getItem('alreadyVotedPolls') || '{}');
        alreadyVotedPolls[id] = true;
        localStorage.setItem('alreadyVotedPolls', JSON.stringify(alreadyVotedPolls));
      } catch (e) { console.error("LocalStorage write error:", e); }
    }
    setError(userFriendlyError);
  };


  // Handle voting action
  const handleVote = async () => {
    if (!isConnected) { openAuthModal(); return; }
    if (selectedOption === null) { setError('Please select an option first.'); return; }
    if (isCreator) { setError('Poll creator cannot vote on their own poll.'); return; }
    if (!poll?.onChain?.isActive) { setError('This poll is no longer active.'); return; }
    if (hasUserVoted()) { setError('You have already voted on this poll.'); return; }

    try {
      setError(null);
      setVoteSuccess(false);
      setRewardReceived(false);
      
      // Execute vote
      const response = await votePoll(id, selectedOption);
      
      // Update localStorage to show user has voted
      try {
        const alreadyVotedPolls = JSON.parse(localStorage.getItem('alreadyVotedPolls') || '{}');
        alreadyVotedPolls[id] = true;
        localStorage.setItem('alreadyVotedPolls', JSON.stringify(alreadyVotedPolls));
      } catch (e) { console.error("LocalStorage write error post-vote:", e); }
      
      // Show success message
      setVoteSuccess(true);
      
      // If poll has rewards, show reward received message and refresh balance
      if (poll.onChain?.hasRewards) { 
        setRewardReceived(true);
        // Set reward amount for display (if not already set)
        if (!rewardAmount && poll.onChain?.rewardPerVoter) {
          setRewardAmount(poll.onChain.rewardPerVoter);
        }
        // Refresh USDT balance to reflect reward
        refreshUSDTBalance();
      }
      
      // After a delay, refresh poll data to show updated vote counts
      setTimeout(async () => {
        try {
            const response = await getPoll(id);
            if (response.data) setPoll(response.data);
        } catch (refreshErr) { console.error("Error refreshing poll data after vote:", refreshErr); }
      }, 1500);
      
      // Clear success messages after a delay
      setTimeout(() => { 
        setVoteSuccess(false);
        setRewardReceived(false);
      }, 8000); // Extended time to ensure user sees the reward notification
    } catch (err) { handleVoteError(err); }
  };

  // Calculate percentage
  const calculatePercentage = (optionIndex) => {
    if (!poll?.onChain?.results || !Array.isArray(poll.onChain.results) || 
        !poll.onChain.totalVotes || poll.onChain.totalVotes <= 0) { 
      return 0; 
    }
    const votesForOption = poll.onChain.results[optionIndex] || 0;
    return Math.round((votesForOption / poll.onChain.totalVotes) * 100);
  };

  // --- Render Logic ---

  // Loading State
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-center items-center min-h-[300px]">
           <svg className="animate-spin h-10 w-10 text-cyan-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           <p className="ml-3 text-gray-600">Loading Poll Details...</p>
        </div>
      </div>
    );
  }

  // Error State (fetch failed or no poll data)
  if (error || !poll) { // Consolidate error display
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md border border-red-200">
        <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="mt-2 text-lg font-medium text-red-800">Error Loading Poll</h3>
            <p className="mt-1 text-red-600">{error || "Poll data could not be retrieved."}</p> {/* Show specific error or generic message */}
            <button onClick={() => navigate('/polls')} className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500">View All Polls</button>
        </div>
      </div>
    );
  }

  // Determine if user has voted and received reward
  const userHasVoted = hasUserVoted();
  const userHasReceivedReward = hasReceivedReward();

  // --- Main Poll Detail Render ---
  return (
    <div className="max-w-3xl mx-auto my-10 p-6 md:p-8 bg-white rounded-xl shadow-lg border border-gray-200/75">
      {/* Poll Header Section */}
      <div className="mb-6 pb-4 border-b border-gray-200">
         <div className="flex justify-between items-start mb-3 flex-wrap gap-y-2">
           <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mr-4">{poll.title || "Untitled Poll"}</h1>
           <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${ poll.onChain?.isActive ? 'bg-green-100 text-green-800 ring-1 ring-green-200' : 'bg-red-100 text-red-800 ring-1 ring-red-200' }`}>{poll.onChain?.isActive ? 'Active' : 'Closed'}</span>
         </div>
         {poll.description && <p className="text-gray-600 mb-4">{poll.description}</p>}
         {poll.imageUrl && (<div className="my-4"><img src={poll.imageUrl} alt={`Visual for poll: ${poll.title}`} className="w-full h-64 object-cover rounded-lg shadow-md border border-gray-100" onError={(e) => { e.target.style.display = 'none'; console.error("Failed to load image:", e.target.src); }}/></div>)}
         <div className="flex flex-wrap gap-2 mb-4">
             <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{poll.category || 'General'}</span>
             {poll.tags && Array.isArray(poll.tags) && poll.tags.map((tag, index) => (<span key={index} className="text-xs font-medium bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-full">#{tag}</span>))}
             {poll.onChain?.hasRewards && (
                <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full flex items-center">
                  <svg className="w-3 h-3 mr-1 fill-current" viewBox="0 0 20 20"><path d="M10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-1.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0zm0 18.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17z"/></svg>
                  Reward: {formatUSDT(poll.onChain?.rewardPerVoter || 0)} USDT
                </span>
             )}
         </div>
         <div className="text-sm text-gray-500 space-y-1">
             <div className="flex items-center"><span className="font-medium w-20 inline-block flex-shrink-0">Created by:</span><span className="truncate" title={poll.creator}>{formatAddress(poll.creator || '')}</span>{isCreator && (<span className="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-medium">You</span>)}</div>
             <div className="flex items-center"><span className="font-medium w-20 inline-block flex-shrink-0">Created:</span><span>{formatDate(poll.createdAt)}</span></div>
             {poll.onChain?.endTime && poll.onChain.endTime !== '1970-01-01T00:00:00.000Z' && (<div className="flex items-center"><span className="font-medium w-20 inline-block flex-shrink-0">Ends:</span><span>{formatDate(poll.onChain.endTime)}</span></div>)}
             <div className="flex items-center"><span className="font-medium w-20 inline-block flex-shrink-0">Total votes:</span><span>{poll.onChain?.totalVotes || 0}</span></div>
             {poll.onChain?.hasRewards && (
                <div className="flex items-center"><span className="font-medium w-20 inline-block flex-shrink-0">Total rewards:</span><span>{parseFloat(formatUSDT(poll.onChain?.rewardPerVoter || 0) * (poll.onChain?.totalVotes || 0)).toFixed(2)} USDT</span></div>
             )}
         </div>
      </div>

      {/* Notification Area */}
      <div className="space-y-4 mb-6">
         {/* Creator note */}
         {isCreator && poll.onChain?.isActive && (
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 rounded-r-md">
              <p className="text-sm"><span className="font-medium">Note:</span> As the poll creator, you cannot vote.</p>
            </div>
         )}
         
         {/* Connected wallet notice */}
         {!isConnected && poll.onChain?.isActive && (
            <div className="p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-700 rounded-r-md">
              <p className="text-sm font-medium">Connect your wallet or sign in to vote.</p>
              <button onClick={openAuthModal} className="mt-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold underline">Sign In / Connect Wallet</button>
            </div>
         )}
         
         {/* Already voted notice */}
         {isConnected && userHasVoted && (
            <div className={`p-4 ${userHasReceivedReward ? 'bg-indigo-50 border-l-4 border-indigo-400 text-indigo-700' : 'bg-green-50 border-l-4 border-green-400 text-green-700'} rounded-r-md`}>
              <p className="text-sm font-medium">You have already cast your vote for this poll.</p>
              {poll.onChain?.hasRewards && userHasReceivedReward && (
                <p className="mt-1 text-sm">You received {formatUSDT(poll.onChain?.rewardPerVoter)} USDT for voting.</p>
              )}
            </div>
         )}
         
         {/* Error message */}
         {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-md" role="alert">
              <p className="text-sm"><span className="font-medium">Error:</span> {error}</p>
            </div>
         )}
         
         {/* Poll error message */}
         {pollError && !error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-md" role="alert">
              <p className="text-sm"><span className="font-medium">Error:</span> {pollError}</p>
            </div>
         )}
         
         {/* Vote success message */}
         {voteSuccess && (
            <div className="p-4 bg-green-50 border-l-4 border-green-400 text-green-700 rounded-r-md" role="alert">
              <p className="text-sm font-medium">Vote successfully submitted!</p>
              {rewardReceived && poll.onChain?.hasRewards && rewardAmount && (
                <div className="mt-2 flex items-center">
                  <svg className="w-4 h-4 mr-1.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-1.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0zm0 18.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17z"/></svg>
                  <p className="text-sm font-medium">You received {formatUSDT(rewardAmount)} USDT reward!</p>
                </div>
              )}
            </div>
         )}
         
         {/* Reward available notice */}
         {poll.onChain?.hasRewards && poll.onChain?.isActive && !userHasVoted && (
            <div className="p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-700 rounded-r-md">
              <h3 className="text-sm font-semibold flex items-center">
                <svg className="w-4 h-4 mr-1.5 fill-current" viewBox="0 0 20 20"><path d="M10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-1.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0zm0 18.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17z"/></svg>
                Reward Available!
              </h3>
              <p className="mt-1 text-sm">Vote on this poll to instantly receive {formatUSDT(poll.onChain?.rewardPerVoter)} USDT in your connected wallet.</p>
              {isConnected && usdtBalance && (
                <p className="mt-1 text-xs">Your current USDT balance: {parseFloat(usdtBalance).toFixed(2)}</p>
              )}
            </div>
         )}
      </div>

      {/* Options / Voting Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Options</h2>
        <div className="space-y-4">
          {poll.options && Array.isArray(poll.options) ? poll.options.map((option, index) => {
            const percentage = calculatePercentage(index);
            const isSelected = selectedOption === index;
            const optionVotes = poll.onChain?.results ? poll.onChain.results[index] || 0 : 0;
            
            // Handle null options with a fallback
            const optionText = option || `Option ${index + 1}`;
            
            return (
              <div key={index}>
                 <label htmlFor={`option-${index}`} className={`block p-4 border rounded-lg cursor-pointer transition-all duration-150 ${ isSelected ? 'bg-cyan-50 border-cyan-300 ring-2 ring-cyan-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300' } ${(!poll.onChain?.isActive || pollLoading || voteSuccess || isCreator || userHasVoted) ? 'opacity-70 cursor-not-allowed' : ''}`}>
                 <div className="flex items-center justify-between">
                   <div className="flex items-center">
                     <input type="radio" id={`option-${index}`} name="poll-option" value={index} checked={isSelected} onChange={() => setSelectedOption(index)} className="h-4 w-4 text-cyan-600 border-gray-300 focus:ring-cyan-500 mr-3" disabled={!poll.onChain?.isActive || pollLoading || voteSuccess || isCreator || userHasVoted}/>
                     <span className={`text-base font-medium ${isSelected ? 'text-cyan-900' : 'text-gray-800'}`}>{optionText}</span>
                   </div>
                   {(userHasVoted || !poll.onChain?.isActive) && poll.onChain?.results && (
                     <span className="text-sm font-medium text-gray-500">{optionVotes} votes</span>
                   )}
                 </div>
                 {(userHasVoted || !poll.onChain?.isActive) && poll.onChain?.results && (
                  <div className="mt-2 flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2 mr-2"><div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div></div>
                    <span className="text-xs font-semibold text-cyan-800 w-8 text-right">{percentage}%</span>
                  </div>
                 )}
                 </label>
              </div>
            );
          }) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700">Options are loading or not available for this poll.</p>
              {poll.onChain?.options && Array.isArray(poll.onChain.options) && (
                <div className="mt-3 space-y-2">
                  {poll.onChain.options.map((option, index) => (
                    <div key={index} className="p-3 bg-white border border-gray-200 rounded">
                      {option || `Option ${index + 1}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Voting Button Area */}
      <div className="mt-8 flex justify-start">
        {poll.onChain?.isActive && isConnected && !isCreator && !userHasVoted && (
         <button 
           onClick={handleVote} 
           disabled={selectedOption === null || pollLoading || voteSuccess} 
           className={`inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition duration-150 ease-in-out ${(selectedOption === null || pollLoading || voteSuccess) ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 active:scale-[0.98]'}`}
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
            poll.onChain?.hasRewards ? (
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Vote & Reward Received!
              </span>
            ) : (
              'Vote Submitted!'
            )
          ) : (
            poll.onChain?.hasRewards ? (
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-1.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0zm0 18.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17z"/>
                </svg>
                Vote & Get {formatUSDT(poll.onChain?.rewardPerVoter)} USDT
              </span>
            ) : (
              'Submit Vote'
            )
          )}
         </button>)}
        {(!poll.onChain?.isActive || isCreator || userHasVoted) && isConnected && (
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
             {poll.contractAddress && (<p>Contract: <span className="font-mono">{poll.contractAddress}</span></p>)}
             {authType && isConnected && (<p>Connected via: <span className="font-medium">{authType === 'magic' ? 'Email (Magic)' : 'Wallet'}</span></p>)}
             <p>Poll ID: <span className="font-mono">{id}</span></p>
         </div>
      </div>
    </div>
  );
};

export default PollDetail;