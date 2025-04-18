// src/pages/PollsList.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import PollCard from '../components/PollCard';
import SubNav from '../components/SubNav';
import logger from '../utils/logger';

const PollsList = () => {
  // Use stable reference for getPolls
  const { getPolls: contextGetPolls, pollLoading } = useAppContext();
  const getPolls = useCallback(contextGetPolls, [contextGetPolls]);

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
  
  // Ref to track current fetch controller
  const controllerRef = useRef(null);

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

  // Initialize search state from URL on mount
  useEffect(() => {
    setSearchQuery(urlSearchQuery);
    logger.debug('Initial URL search query detected:', urlSearchQuery);
  }, [urlSearchQuery]);

  // Central fetch function to handle all API calls with abort controller
  const fetchPolls = useCallback(async (params, isSearch = false) => {
    // Cancel any in-flight requests
    if (controllerRef.current) {
      logger.debug('Canceling previous request...');
      controllerRef.current.abort('New request starting');
    }

    // Create new controller for this request
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    // Add signal to params
    const fetchParams = { ...params, signal };

    logger.debug(`Fetching polls (${isSearch ? 'search' : 'filter'}) with params:`, fetchParams);
    setLoading(true);

    try {
      const result = await getPolls(fetchParams);
      
      // Check if the request was aborted during the await
      if (signal.aborted) {
        logger.debug("Fetch aborted during await, skipping state update.");
        return;
      }

      logger.debug("Fetch successful, updating state.");
      setPolls(result.data || []);
      setTotalPages(result.pagination?.totalPages || 1);
      setLoading(false);
    } catch (error) {
      // Handle different error types
      if (signal.aborted || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        logger.debug('Request cancelled (expected):', error.message);
        // Don't update loading state for aborted requests
      } else {
        logger.error('Error fetching polls:', error);
        setLoading(false);
        setPolls([]);
      }
    }
  }, [getPolls]);

  // Process filter parameters and create fetch params
  const buildFilterParams = useCallback(() => {
    const params = {
      page,
      limit: 9,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };

    // Apply category if relevant
    if (category) {
      params.category = category;
    }

    // Determine active status based on filter
    if (filter === 'completed') {
      params.active = false;
      delete params.category;
    } else if (filter === 'new' || filter === 'reward' || activeOnly) {
      params.active = true;
    }

    // Handle special API parameters based on filter
    if (filter) {
      switch (filter) {
        case 'reward':
          params.hasRewards = true;
          break;
        case 'new':
          params.sortBy = 'createdAt';
          params.sortOrder = 'desc';
          break;
        case 'age':
        case 'gender':
        case 'race':
        case 'income':
        case 'pet-owner':
        case 'relationship':
        case 'education':
          params.category = filter.charAt(0).toUpperCase() + filter.slice(1).replace('-', ' ');
          break;
        default:
          break;
      }
    }

    return params;
  }, [filter, page, category, activeOnly]);

  // Main effect for fetching polls based on filter, pagination, etc.
  useEffect(() => {
    logger.debug('PollsList EFFECT - Dependencies changed:', { 
      filter, page, category, activeOnly, search: location.search 
    });

    // Skip fetching if there's a search query in the URL - search effect will handle it
    if (urlSearchQuery) {
      logger.debug("Skipping filter fetch due to URL search query");
      return;
    }

    // Process filter parameter and derive state
    const processFilterState = () => {
      let newCategory = category;
      let newActiveOnly = activeOnly;
      let stateChanged = false;

      if (filter) {
        // Process filter to determine category and activeOnly states
        switch (filter) {
          case 'all':
            if (activeOnly !== false) {
              newActiveOnly = false;
              stateChanged = true;
            }
            break;
          case 'new':
          case 'reward':
            if (activeOnly !== true) {
              newActiveOnly = true;
              stateChanged = true;
            }
            break;
          case 'completed':
            if (activeOnly !== false) {
              newActiveOnly = false;
              stateChanged = true;
            }
            if (category !== '') {
              newCategory = '';
              stateChanged = true;
            }
            break;
          case 'age':
          case 'gender':
          case 'race':
          case 'income':
          case 'pet-owner':
          case 'relationship':
          case 'education': {
            const derivedCategory = filter.charAt(0).toUpperCase() + filter.slice(1).replace('-', ' ');
            if (category !== derivedCategory) {
              newCategory = derivedCategory;
              stateChanged = true;
            }
            break;
          }
          default:
            break;
        }
      }

      // Return whether we need state updates first
      return { 
        stateChanged,
        newCategory,
        newActiveOnly
      };
    };

    const { stateChanged, newCategory, newActiveOnly } = processFilterState();

    // If filter caused state changes, update states and exit
    // The effect will run again with the new state values
    if (stateChanged) {
      logger.debug('Filter caused state changes, updating state before fetch');
      if (newCategory !== category) setCategory(newCategory);
      if (newActiveOnly !== activeOnly) setActiveOnly(newActiveOnly);
      if (page !== 1) setPage(1);
      return;
    }

    // Proceed with fetch using filter parameters
    const params = buildFilterParams();
    fetchPolls(params, false);

    // Cleanup function to abort request when dependencies change or component unmounts
    return () => {
      if (controllerRef.current) {
        logger.debug('PollsList EFFECT CLEANUP - Aborting controller');
        controllerRef.current.abort('Dependencies changed or component unmounting');
        controllerRef.current = null;
      }
    };
  }, [filter, page, category, activeOnly, location.search, urlSearchQuery, buildFilterParams, fetchPolls]);

  // Separate effect for handling search query
  useEffect(() => {
    if (!urlSearchQuery) return;

    logger.debug("Search Effect: Handling URL search query:", urlSearchQuery);
    
    const params = {
      search: urlSearchQuery,
      limit: 9,
      page: 1
    };

    // Add active filter if applicable
    if (activeOnly) {
      params.active = true;
    }

    fetchPolls(params, true);
  }, [urlSearchQuery, activeOnly, fetchPolls]);

  // Handle search form submission
  const handleSearch = (e) => {
    if (e) e.preventDefault();

    const trimmedQuery = searchQuery.trim();
    const currentSearchParams = new URLSearchParams(location.search);

    // Update URL and navigation
    if (trimmedQuery) {
      currentSearchParams.set('search', trimmedQuery);
      navigate(`/polls?${currentSearchParams.toString()}`, { replace: true });
    } else {
      currentSearchParams.delete('search');
      const filterPath = filter || 'all';
      navigate(`/polls/${filterPath}${currentSearchParams.toString() ? '?' + currentSearchParams.toString() : ''}`, { replace: true });
    }

    // No direct fetchPolls call here - the URL change will trigger the search effect
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(prevPage => prevPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(prevPage => prevPage - 1);
    }
  };

  // Get page title based on filter or search
  const getPageTitle = () => {
    const currentUrlSearch = new URLSearchParams(location.search).get('search');
    if (currentUrlSearch) {
      return `Search Results: "${currentUrlSearch}"`;
    }

    if (!filter || filter === 'all') return 'Browse All Polls';

    switch (filter) {
      case 'new': return 'New Polls';
      case 'completed': return 'Completed Polls';
      case 'reward': return 'Polls with Rewards';
      case 'age':
      case 'gender':
      case 'race':
      case 'income':
      case 'pet-owner':
      case 'relationship':
      case 'education':
        return `${filter.charAt(0).toUpperCase() + filter.slice(1).replace('-', ' ')} Related Polls`;
      default: return `${filter.charAt(0).toUpperCase() + filter.slice(1)} Polls`;
    }
  };

  // Handler for category dropdown change
  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    logger.debug("Category changed to:", newCategory);
    setCategory(newCategory);
    if (page !== 1) setPage(1);
  };

  // Handler for activeOnly checkbox change
  const handleActiveOnlyChange = (e) => {
    const newActiveOnly = e.target.checked;
    logger.debug("ActiveOnly changed to:", newActiveOnly);
    setActiveOnly(newActiveOnly);
    if (page !== 1) setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-4">{getPageTitle()}</h1>

      {/* SubNav component */}
      <SubNav nonClickableItems={['live']} />

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-lg shadow mt-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start md:items-end">
            {/* Category Filter Dropdown */}
            {(!filter || ['all', 'new', 'reward'].includes(filter)) && (
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={handleCategoryChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  disabled={['age', 'gender', 'race', 'income', 'pet-owner', 'relationship', 'education'].includes(filter)}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Active Filter Checkbox */}
            {filter !== 'completed' && (
              <div className="flex items-center pt-2 sm:pt-0 sm:pb-[2px] sm:mt-1">
                <label className="inline-flex items-center whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                    checked={activeOnly}
                    onChange={handleActiveOnlyChange}
                    disabled={filter === 'new' || filter === 'reward'}
                  />
                  <span className="ml-2 text-sm text-gray-700">Active polls only</span>
                </label>
              </div>
            )}
          </div>

          {/* Search Form */}
          <div className="flex-1 max-w-xs md:max-w-sm lg:max-w-md">
            <form onSubmit={handleSearch} className="flex gap-2 items-end">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Polls
                </label>
                <input
                  type="text"
                  id="search"
                  placeholder="By title or description"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md py-2"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 whitespace-nowrap"
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
      {!loading && polls.length > 0 && totalPages > 1 && (
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handlePrevPage}
            disabled={page === 1}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={page === totalPages}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default PollsList;