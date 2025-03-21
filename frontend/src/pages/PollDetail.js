import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Web3Context } from '../context/Web3Context';

const PollDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPoll, votePoll, isConnected, account } = useContext(Web3Context);
  
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [voting, setVoting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  
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
  
  // Handle voting
  const handleVote = async () => {
    if (!isConnected) {
      setError('Please connect your wallet to vote');
      return;
    }
    
    if (selectedOption === null) {
      setError('Please select an option');
      return;
    }
    
    try {
      setVoting(true);
      setError(null);
      
      await votePoll(id, selectedOption);
      
      // Refresh poll data after voting
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
      setError(err.response?.data?.error || 'Failed to submit vote');
      setVoting(false);
    }
  };
  
  // Calculate percentage for option
  const calculatePercentage = (optionIndex) => {
    if (!poll?.onChain?.results || !poll.onChain.totalVotes) return 0;
    return Math.round((poll.onChain.results[optionIndex] / poll.onChain.totalVotes) * 100);
  };
  
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center py-8">
          <p>Loading poll...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
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
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${poll.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {poll.isActive ? 'Active' : 'Closed'}
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
        </div>
        
        <div className="text-sm text-gray-500 space-y-1 mb-4">
          <div>
            <span className="font-medium">Created by: </span>
            <span>{formatAddress(poll.creator)}</span>
            {poll.creator.toLowerCase() === account?.toLowerCase() && (
              <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                You
              </span>
            )}
          </div>
          
          <div>
            <span className="font-medium">Created: </span>
            <span>{formatDate(poll.createdAt)}</span>
          </div>
          
          {poll.endTime && (
            <div>
              <span className="font-medium">Ends: </span>
              <span>{formatDate(poll.endTime)}</span>
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
                disabled={!poll.isActive || !isConnected || voteSuccess}
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
      
      {poll.isActive && (
        <div className="flex justify-end">
          <button
            onClick={handleVote}
            disabled={selectedOption === null || !isConnected || voting || voteSuccess}
            className="btn btn-primary"
          >
            {voting ? 'Submitting Vote...' : 'Vote'}
          </button>
        </div>
      )}
      
      <div className="mt-8 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          <p>Contract Address: {poll.contractAddress}</p>
        </div>
      </div>
    </div>
  );
};

export default PollDetail;