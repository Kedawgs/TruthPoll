import React from 'react';
import { Link } from 'react-router-dom';

const PollCard = ({ poll }) => {
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'; // Handle potential null dates
    try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleDateString();
    } catch (e) {
        console.error("Error formatting date in PollCard:", dateString, e);
        return 'Error Date';
    }
  };


  // Format address
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col h-full"> {/* Added flex classes for layout */}
      <div className="p-5 flex-grow"> {/* Added flex-grow */}
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

        <h3 className="text-lg font-semibold mb-2 text-gray-800 break-words">{poll.title}</h3> {/* Added break-words */}

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
            <span className="font-medium truncate" title={poll.creator}>{formatAddress(poll.creator)}</span> {/* Added truncate */}
          </div>

          <div className="flex items-center">
            <span className="mr-1">Created:</span>
            <span className="font-medium">{formatDate(poll.createdAt)}</span>
          </div>

          {/* Display End Time only if it exists and is valid */}
          {poll.endTime && poll.endTime !== '1970-01-01T00:00:00.000Z' && (
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
                className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full" // Adjusted styling slightly
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Link pushed to bottom */}
      <div className="p-5 pt-0 mt-auto"> {/* Ensure link is at the bottom */}
          <Link
            // --- THIS IS THE CORRECTED LINE ---
            to={`/polls/id/${poll._id}`}
            // --- END CORRECTION ---
            className="block w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition duration-150 ease-in-out" // Example styling, adjust as needed
          >
            View Poll
          </Link>
      </div>
    </div>
  );
};

export default PollCard;