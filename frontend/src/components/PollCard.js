import React from 'react';
import { Link } from 'react-router-dom';

const PollCard = ({ poll }) => {
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Format address
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="p-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {poll.category || 'General'}
          </span>
          {poll.isActive ? (
            <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded">
              Active
            </span>
          ) : (
            <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-1 rounded">
              Closed
            </span>
          )}
        </div>

        <h3 className="text-lg font-semibold mb-2 text-gray-800">{poll.title}</h3>
        
        {poll.description && (
          <p className="text-sm text-gray-600 mb-4">
            {poll.description.length > 100 
              ? `${poll.description.substring(0, 100)}...` 
              : poll.description}
          </p>
        )}
        
        <div className="text-xs text-gray-500 space-y-1 mb-4">
          <div className="flex items-center">
            <span className="mr-1">Created by:</span>
            <span className="font-medium">{formatAddress(poll.creator)}</span>
          </div>
          
          <div className="flex items-center">
            <span className="mr-1">Created:</span>
            <span className="font-medium">{formatDate(poll.createdAt)}</span>
          </div>
          
          {poll.endTime && (
            <div className="flex items-center">
              <span className="mr-1">Ends:</span>
              <span className="font-medium">{formatDate(poll.endTime)}</span>
            </div>
          )}
        </div>
        
        {poll.tags && poll.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {poll.tags.map((tag, index) => (
              <span 
                key={index}
                className="text-xs bg-primary-50 text-primary-600 px-2 py-1 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        
        <Link 
          to={`/polls/${poll._id}`}
          className="block w-full text-center btn btn-primary mt-2"
        >
          View Poll
        </Link>
      </div>
    </div>
  );
};

export default PollCard;