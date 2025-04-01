// src/pages/PollsList.js
import React, { useEffect, useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import PollCard from '../components/PollCard';

const PollsList = () => {
  const { getPolls, pollLoading } = useAppContext();
  const { filter } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract search query from URL if present
  const searchParams = new URLSearchParams(location.search);
  const urlSearchQuery = searchParams.get('search') || '';
  
  // Component state
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [activeOnly, setActiveOnly] = useState(false);
  
  // Categories list
  const categories = [
    { id: '', name: 'All' },
    { id: 'General', name: 'General' },
    { id: 'Politics', name: 'Politics' },
    { id: 'Technology', name: 'Technology' },
    { id: 'Sports', name: 'Sports' },
    { id: 'Entertainment', name: 'Entertainment' },
    { id: 'Other', name: 'Other' }
  ];
  
  // Process filter parameter to determine what polls to fetch
  useEffect(() => {
    if (filter) {
      switch (filter) {
        case 'all':
          setActiveOnly(false);
          setCategory('');
          break;
        case 'new':
          // For new polls, we'll keep the category but sort by creation date
          setActiveOnly(true);
          break;
        case 'completed':
          setActiveOnly(false);
          // Set to fetch only completed polls
          setCategory('');
          // We'll handle this in the fetchPolls function
          break;
        case 'reward':
          // For reward polls, we'll need a special parameter
          setActiveOnly(true);
          // We'll handle this in the fetchPolls function
          break;
        // Handle demographic-based filters
        case 'age':
        case 'gender':
        case 'race':
        case 'income':
        case 'pet-owner':
        case 'relationship':
        case 'education':
          // Set the category to match the filter
          setCategory(filter.charAt(0).toUpperCase() + filter.slice(1));
          break;
        default:
          // Default behavior keeps current filter settings
          break;
      }
      
      // Reset to page 1 when changing filters
      setPage(1);
    }
  }, [filter]);
  
  // Run search from URL params on initial load
  useEffect(() => {
    if (urlSearchQuery) {
      handleSearch({ preventDefault: () => {} });
    }
  }, []);
  
  useEffect(() => {
    fetchPolls();
  }, [page, category, activeOnly, filter]);
  
  const fetchPolls = async () => {
    try {
      setLoading(true);
      
      const params = {
        page,
        limit: 9,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };
      
      if (category) {
        params.category = category;
      }
      
      if (activeOnly) {
        params.active = true;
      }
      
      // Handle special filter cases
      if (filter) {
        switch (filter) {
          case 'completed':
            params.active = false;
            break;
          case 'reward':
            params.hasRewards = true;
            break;
          case 'new':
            // Sort by creation date descending (most recent first)
            params.sortBy = 'createdAt';
            params.sortOrder = 'desc';
            break;
          default:
            // No special parameters for other filters
            break;
        }
      }
      
      const result = await getPolls(params);
      setPolls(result.data);
      setTotalPages(result.pagination.totalPages);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching polls:', error);
      setLoading(false);
    }
  };
  
  const handleSearch = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // If search query is empty, reset to normal listing
      if (!searchQuery.trim()) {
        fetchPolls();
        return;
      }
      
      // Now using the search parameter from the updated controller
      const params = {
        search: searchQuery,
        limit: 9
      };
      
      const result = await getPolls(params);
      setPolls(result.data);
      
      // Update URL without reloading the page
      const searchParams = new URLSearchParams();
      searchParams.set('search', searchQuery);
      navigate(`/polls?${searchParams.toString()}`);
      
      setLoading(false);
    } catch (error) {
      console.error('Error searching polls:', error);
      setLoading(false);
    }
  };
  
  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };
  
  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };
  
  // Get title based on filter
  const getPageTitle = () => {
    if (searchQuery) return `Search Results: ${searchQuery}`;
    
    if (!filter) return 'Browse Polls';
    
    switch (filter) {
      case 'all': return 'All Polls';
      case 'new': return 'New Polls';
      case 'completed': return 'Completed Polls';
      case 'reward': return 'Polls with Rewards';
      case 'age': return 'Age-Related Polls';
      case 'gender': return 'Gender-Related Polls';
      case 'race': return 'Race-Related Polls';
      case 'income': return 'Income-Related Polls';
      case 'pet-owner': return 'Pet Owner Polls';
      case 'relationship': return 'Relationship Polls';
      case 'education': return 'Education Polls';
      default: return `${filter.charAt(0).toUpperCase() + filter.slice(1)} Polls`;
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8">{getPageTitle()}</h1>
      
      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow mb-8">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Category Filter */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Active Filter */}
            <div className="flex items-end">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                />
                <span className="ml-2">Active polls only</span>
              </label>
            </div>
          </div>
          
          {/* Search */}
          <div className="flex-1 max-w-md">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Polls
                </label>
                <input
                  type="text"
                  id="search"
                  placeholder="Search by title or description"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              <button
                type="submit"
                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </div>
      
      {/* Polls Grid */}
      {loading || pollLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
          <p className="mt-4">Loading polls...</p>
        </div>
      ) : polls.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {polls.map(poll => (
            <PollCard key={poll._id} poll={poll} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No polls found matching your criteria.</p>
        </div>
      )}
      
      {/* Pagination */}
      {!loading && polls.length > 0 && (
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handlePrevPage}
            disabled={page === 1}
            className="btn btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          
          <span>
            Page {page} of {totalPages}
          </span>
          
          <button
            onClick={handleNextPage}
            disabled={page === totalPages}
            className="btn btn-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default PollsList;