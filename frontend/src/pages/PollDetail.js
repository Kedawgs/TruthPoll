// src/pages/PollDetail.js
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Web3Context } from '../context/Web3Context';
import { ethers } from 'ethers';

const PollDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    getPoll, 
    votePoll, 
    isConnected, 
    account, 
    authType,
    openAuthModal,
    claimReward
  } = useContext(Web3Context);
  
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [voting, setVoting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  
  // Check if current user is creator
  const isCreator = poll?.creator?.toLowerCase() === account?.toLowerCase();
  
  // Fetch poll data
  useEffect(() => {
    const fetchPoll = async () => {
      try {
        setLoading(true);
        const response = await getPoll(id);
        setPoll(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching poll:', err);
        setError('Failed to load poll');
        setLoading(false);
      }
    };
    
    fetchPoll();
  }, [id, getPoll]);
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'No end date';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Format address
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Format USDT amount
  const formatUSDT = (amount) => {
    if (!amount) return '0';
    return parseFloat(amount).toFixed(2);
  };
  
  // Handle voting
  const handleVote = async () => {
    if (!isConnected) {
      openAuthModal();
      return;
    }
    
    if (selectedOption === null) {
      setError('Please select an option');
      return;
    }
    
    if (isCreator) {
      setError('Poll creator cannot vote on their own poll');
      return;
    }
    
    try {
      setVoting(true);
      setError(null);
      
      // Uses the unified votePoll method (works with both Magic and smart wallets)
      await votePoll(id, selectedOption);
      
      // Refresh poll data
      const response = await getPoll(id);
      setPoll(response.data);
      
      setVoting(false);
      setVoteSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setVoteSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error voting:', err);
      setError(err.response?.data?.error || err.message || 'Failed to submit vote');
      setVoting(false);
    }
  };
  
  // Handle reward claim
  const handleClaimReward = async () => {
    if (!isConnected) {
      openAuthModal();
      return;
    }
    
    try {
      setClaiming(true);
      setError(null);
      
      // Uses the unified claimReward method (works with both Magic and smart wallets)
      await claimReward(poll.contractAddress);
      
      setClaiming(false);
      setClaimSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setClaimSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error claiming reward:', err);
      setError(err.response?.data?.error || err.message || 'Failed to claim reward');
      setClaiming(false);
    }
  };
  
  // Calculate percentage for option
  const calculatePercentage = (optionIndex) => {
    if (!poll?.onChain?.results || !poll.onChain.totalVotes) return 0;
    return Math.round((poll.onChain.results[optionIndex] / poll.onChain.totalVotes) * 100);
  };
  
  // Check if user has already voted
  const hasUserVoted = () => {
    if (!poll?.onChain) return false;
    
    // Check if there's any vote data
    return poll.onChain.results.some((count, index) => {
      const isSelected = poll.onChain.userVote === index;
      return isSelected && count > 0;
    });
  };
  
  // Check if user can claim reward
  const canClaimReward = () => {
    if (!poll?.onChain) return false;
    
    return (
      poll.onChain.hasRewards && 
      hasUserVoted() && 
      (!poll.onChain.isActive || new Date() >= new Date(poll.onChain.endTime))
    );
  };
  
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }
  
  if (error && !poll) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center py-8">
          <p className="text-red-500">{error}</p>
          <button 
            onClick={() => navigate('/polls')} 
            className="mt-4 btn btn-primary"
          >
            View All Polls
          </button>
        </div>
      </div>
    );
  }
  
  if (!poll) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center py-8">
          <p>Poll not found</p>
          <button 
            onClick={() => navigate('/polls')} 
            className="mt-4 btn btn-primary"
          >
            View All Polls
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto my-10 p-8 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold">{poll.title}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            poll.onChain?.isActive 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {poll.onChain?.isActive ? 'Active' : 'Closed'}
          </span>
        </div>
        
        {poll.description && (
          <p className="text-gray-600 mb-4">{poll.description}</p>
        )}
        
        <div className="flex flex-wrap gap-1 mb-4">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {poll.category || 'General'}
          </span>
          
          {poll.tags && poll.tags.map((tag, index) => (
            <span 
              key={index}
              className="text-xs bg-primary-50 text-primary-600 px-2 py-1 rounded"
            >
              #{tag}
            </span>
          ))}
          
          {poll.onChain?.hasRewards && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded flex items-center">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13z"/>
                <path d="M10 5a1 1 0 011 1v3.586l2.707 2.707a1 1 0 01-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 01-1.414-1.414L9 9.586V6a1 1 0 011-1z"/>
              </svg>
              Reward: {formatUSDT(poll.onChain?.rewardPerVoter)} USDT
            </span>
          )}
        </div>
        
        <div className="text-sm text-gray-500 space-y-1 mb-4">
          <div>
            <span className="font-medium">Created by: </span>
            <span>{formatAddress(poll.creator)}</span>
            {isCreator && (
              <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                You
              </span>
            )}
          </div>
          
          <div>
            <span className="font-medium">Created: </span>
            <span>{formatDate(poll.createdAt)}</span>
          </div>
          
          {poll.onChain?.endTime && (
            <div>
              <span className="font-medium">Ends: </span>
              <span>{formatDate(poll.onChain.endTime)}</span>
            </div>
          )}
          
          {poll.onChain?.totalVotes !== undefined && (
            <div>
              <span className="font-medium">Total votes: </span>
              <span>{poll.onChain.totalVotes}</span>
            </div>
          )}
        </div>
      </div>
      
      {isCreator && poll.onChain?.isActive && (
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700">
          <p>As the creator of this poll, you cannot vote on it.</p>
        </div>
      )}
      
      {!isConnected && (
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-700">
          <p>Connect your wallet or sign in to vote on this poll.</p>
          <button 
            onClick={openAuthModal}
            className="mt-2 text-blue-700 underline"
          >
            Sign In / Connect Wallet
          </button>
        </div>
      )}
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          <p>{error}</p>
        </div>
      )}
      
      {voteSuccess && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
          <p>Your vote has been successfully recorded!</p>
        </div>
      )}
      
      {claimSuccess && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
          <p>Your reward has been successfully claimed!</p>
        </div>
      )}
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Options</h2>
        
        {poll.options.map((option, index) => (
          <div key={index} className="mb-4">
            <div className="flex items-center mb-1">
              <input
                type="radio"
                id={`option-${index}`}
                name="poll-option"
                value={index}
                checked={selectedOption === index}
                onChange={() => setSelectedOption(index)}
                className="mr-2"
                disabled={!poll.onChain?.isActive || voting || voteSuccess || isCreator || hasUserVoted()}
              />
              <label htmlFor={`option-${index}`} className="font-medium">
                {option}
              </label>
            </div>
            
            {poll.onChain?.results && (
              <div className="mt-1">
                <div className="flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary-600 h-2.5 rounded-full" 
                      style={{ width: `${calculatePercentage(index)}%` }}
                    ></div>
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-500">
                    {poll.onChain.results[index] || 0} votes ({calculatePercentage(index)}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex justify-between">
        {poll.onChain?.isActive && !hasUserVoted() && !isCreator && (
          <button
            onClick={handleVote}
            disabled={selectedOption === null || !isConnected || voting || voteSuccess || isCreator}
            className="btn btn-primary"
          >
            {voting ? 'Submitting Vote...' : 'Vote'}
          </button>
        )}
        
        {canClaimReward() && (
          <button
            onClick={handleClaimReward}
            disabled={claiming || claimSuccess}
            className="btn btn-primary bg-yellow-600 hover:bg-yellow-700"
          >
            {claiming ? 'Claiming Reward...' : 'Claim USDT Reward'}
          </button>
        )}
      </div>
      
      <div className="mt-8 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          <p>Contract Address: {poll.contractAddress}</p>
          {authType && (
            <p className="mt-1">Connected as: {authType === 'magic' ? 'Magic User' : 'Wallet User'}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PollDetail;