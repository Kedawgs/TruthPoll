// src/components/NavbarSearchDropdown.js
import React from 'react';
import { Link } from 'react-router-dom';

const NavbarSearchDropdown = ({ 
  isVisible, 
  results, 
  loading, 
  onSelectResult, 
  activeFilters, 
  onFilterChange,
  searchQuery 
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-md shadow-lg z-50">
      {/* Filters Section */}
      <div className="p-3 border-b">
        <div className="flex gap-2">
          <button 
            className={`px-3 py-1 text-sm rounded-full ${activeFilters.includes('Active') 
              ? 'bg-primary-100 text-primary-800 font-medium' 
              : 'bg-gray-100 text-gray-700'}`}
            onClick={() => onFilterChange('Active')}
            type="button"
          >
            Active
          </button>
          <button 
            className={`px-3 py-1 text-sm rounded-full ${activeFilters.includes('Ended') 
              ? 'bg-primary-100 text-primary-800 font-medium' 
              : 'bg-gray-100 text-gray-700'}`}
            onClick={() => onFilterChange('Ended')}
            type="button"
          >
            Ended
          </button>
        </div>
      </div>

      {/* Results Section */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="inline-block animate-spin h-4 w-4 border-2 border-gray-300 border-t-primary-600 rounded-full mr-2"></div>
            <span className="text-sm text-gray-600">Searching...</span>
          </div>
        ) : results.length > 0 ? (
          results.map(poll => (
            <Link 
              key={poll._id} 
              to={`/polls/${poll._id}`}
              onClick={() => onSelectResult(poll)}
              className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-md flex-shrink-0 overflow-hidden">
                  {poll.image ? (
                    <img src={poll.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.5-4.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zm-7 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="text-sm truncate max-w-[180px]">
                  {poll.title}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  {poll.cachedVoteCount !== undefined ? 
                    `${poll.cachedVoteCount} votes` : 
                    <span className="text-gray-400">— votes</span>}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(poll.createdAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="p-4 text-center text-sm text-gray-600">
            No results found
          </div>
        )}
      </div>

      {/* Link to see all results */}
      {results.length > 0 && searchQuery && (
        <div className="p-2 border-t">
          <Link 
            to={`/polls?search=${encodeURIComponent(searchQuery)}`} 
            className="block w-full text-center text-sm text-primary-600 py-1 hover:text-primary-800"
          >
            See all results
          </Link>
        </div>
      )}
    </div>
  );
};

export default NavbarSearchDropdown;