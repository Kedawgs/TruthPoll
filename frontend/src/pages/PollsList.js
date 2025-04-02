// src/pages/PollsList.js
import React, { useEffect, useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import PollCard from '../components/PollCard';
import SubNav from '../components/SubNav'; // Added import

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
  const [category, setCategory] = useState(''); // Keep category state for the dropdown filter
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [activeOnly, setActiveOnly] = useState(false); // Keep activeOnly state for the checkbox

  // Categories list (remains the same)
  const categories = [
    { id: '', name: 'All' },
    { id: 'General', name: 'General' },
    { id: 'Politics', name: 'Politics' },
    { id: 'Technology', name: 'Technology' },
    { id: 'Sports', name: 'Sports' },
    { id: 'Entertainment', name: 'Entertainment' },
    { id: 'Other', name: 'Other' }
  ];

  // Run search from URL params on initial load (remains the same)
  useEffect(() => {
    if (urlSearchQuery) {
      handleSearch({ preventDefault: () => {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Keep this effect for initial URL search handling

  // Combined effect for processing filter, fetching polls, and handling abort
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const processFilterAndFetch = async () => {
        setLoading(true);
        let currentCategory = ''; // Reset local category for filter processing
        let currentActiveOnly = false; // Reset local activeOnly for filter processing

        // Process filter parameter to determine base settings
        if (filter) {
          switch (filter) {
            case 'all':
              currentActiveOnly = false;
              currentCategory = '';
              break;
            case 'new':
              // 'new' implies active polls, sorted by creation date
              currentActiveOnly = true;
              // Keep category selection if user chose one via dropdown
              currentCategory = category;
              break;
            case 'completed':
              currentActiveOnly = false;
              currentCategory = ''; // Completed overrides category dropdown
              break;
            case 'reward':
               // 'reward' implies active polls with rewards
              currentActiveOnly = true;
              // Keep category selection if user chose one via dropdown
              currentCategory = category;
              break;
            // Handle demographic-based filters as categories
            case 'age':
            case 'gender':
            case 'race':
            case 'income':
            case 'pet-owner':
            case 'relationship':
            case 'education':
              // Set the category to match the filter, overriding dropdown
              currentCategory = filter.charAt(0).toUpperCase() + filter.slice(1);
              // Keep activeOnly selection if user checked the box
              currentActiveOnly = activeOnly;
              break;
            default:
                // For unknown filters or direct category selection via dropdown when filter is not set
                // Use the state values set by the dropdown and checkbox
                currentCategory = category;
                currentActiveOnly = activeOnly;
              break;
          }
          // Apply the determined settings to state for UI consistency (dropdown/checkbox)
          setCategory(currentCategory);
          setActiveOnly(currentActiveOnly);

          // Reset to page 1 only when the main filter changes
          // We check if page is already 1 to avoid unnecessary state updates/re-renders
          if (page !== 1) {
            setPage(1);
            // Note: Setting page will trigger this effect again, fetching page 1.
            // This is acceptable as the logic correctly handles dependencies.
            // Alternatively, could directly build params for page 1 here,
            // but letting the state update handle it is cleaner.
            setLoading(false); // Stop loading indicator briefly before page change triggers refetch
            return; // Exit early, the effect will re-run with page=1
          }

        } else {
             // If no filter param, rely on dropdown/checkbox state
            currentCategory = category;
            currentActiveOnly = activeOnly;
        }


        // Construct fetch parameters based on processed filter/state
        const params = {
            page,
            limit: 9,
            sortBy: 'createdAt', // Default sort
            sortOrder: 'desc',   // Default sort order
            signal // Pass the abort signal
        };

        if (currentCategory) {
            params.category = currentCategory;
        }

        // This check ensures 'activeOnly' from checkbox isn't overridden unless filter requires it
        if (currentActiveOnly || (filter !== 'completed' && activeOnly)) {
             params.active = true;
        }

        // Handle special filter cases for API query parameters
        if (filter) {
            switch (filter) {
                case 'completed':
                    params.active = false; // Explicitly fetch inactive
                    delete params.category; // Ensure completed polls across all categories
                    break;
                case 'reward':
                    params.hasRewards = true;
                    // params.active = true is already set if currentActiveOnly is true
                    break;
                case 'new':
                    // Sort by creation date descending (most recent first)
                    params.sortBy = 'createdAt';
                    params.sortOrder = 'desc';
                    // params.active = true is already set if currentActiveOnly is true
                    break;
                // No special parameters needed for category/demographic filters here
                // as category is handled above.
                default:
                    break;
            }
        }

        // If a dropdown category is selected WITHOUT a filter param, use it
        if (!filter && category) {
             params.category = category;
        }
        // If activeOnly checkbox is checked WITHOUT a filter param, use it
        if (!filter && activeOnly) {
            params.active = true;
        }


        // Fetch the polls
        try {
            const result = await getPolls(params);
            setPolls(result.data);
            setTotalPages(result.pagination.totalPages);
            setLoading(false);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted'); // Request was aborted, likely due to filter/page change or unmount
                // No need to setLoading(false) here if a new fetch is likely starting
                return;
            }
            console.error('Error fetching polls:', error);
            setLoading(false); // Set loading false on actual fetch error
        }
    };

    // Don't fetch if search is active from URL on initial load, let handleSearch manage it
    if (!urlSearchQuery || location.search === '') {
         processFilterAndFetch();
    } else {
        setLoading(false); // Ensure loading is false if initial fetch is skipped due to search param
    }


    // Cleanup function to abort request
    return () => {
        controller.abort();
    };
    // Dependencies: filter (from URL), getPolls (stable function ref), page (for pagination)
    // category and activeOnly states are now managed *within* the effect based on filter,
    // or used directly if no filter is present. Fetch trigger relies on filter or page change.
    // Added location.search to re-evaluate if search query is removed.
  }, [filter, getPolls, page, category, activeOnly, location.search, urlSearchQuery]); // Added category, activeOnly, location.search, urlSearchQuery


  // fetchPolls remains needed for search functionality separate from filter/pagination fetches
  const fetchPolls = async (fetchParams) => {
    try {
      setLoading(true);
      const result = await getPolls(fetchParams);
      setPolls(result.data);
      setTotalPages(result.pagination.totalPages);
      setLoading(false);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching polls (general):', error);
        setLoading(false);
      }
    }
  };


  const handleSearch = async (e) => {
    e.preventDefault();
    setPage(1); // Reset page to 1 for search results

    // Update URL immediately to reflect search query
    const currentSearchParams = new URLSearchParams(location.search);
    if (searchQuery.trim()) {
      currentSearchParams.set('search', searchQuery);
      // Keep filter if present? Decide based on desired UX. Here we keep it.
      // navigate(`/polls/${filter || 'all'}?${currentSearchParams.toString()}`);
      // Or clear filter when searching?
      navigate(`/polls?${currentSearchParams.toString()}`); // Clears filter path, uses query param
    } else {
      currentSearchParams.delete('search');
       // Revert to filter path if search is cleared
       navigate(`/polls/${filter || 'all'}${currentSearchParams.toString() ? '?' + currentSearchParams.toString() : ''}`);
    }


    try {
      setLoading(true);

      // If search query is empty, refetch based on current filter/page (handled by useEffect)
      if (!searchQuery.trim()) {
         // Trigger useEffect by potentially changing location.search
         // The useEffect dependency on location.search will handle the refetch
        setLoading(false); // Stop loading indicator
        return;
      }

      // Prepare search parameters
      const params = {
        search: searchQuery,
        limit: 9,
        page: 1 // Always search from page 1
        // Add other relevant params if search should respect them, e.g., activeOnly?
        // if (activeOnly) params.active = true;
      };

      const result = await getPolls(params);
      setPolls(result.data);
      // Assuming search returns pagination
      setTotalPages(result.pagination ? result.pagination.totalPages : 1);

      setLoading(false);
    } catch (error) {
       if (error.name !== 'AbortError') {
          console.error('Error searching polls:', error);
          setLoading(false);
       }
    }
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

  // Get title based on filter or search (adjusted logic slightly)
   const getPageTitle = () => {
        // If there's an active search query in the state, prioritize showing search results title
        if (searchQuery && location.search.includes(`search=${encodeURIComponent(searchQuery)}`)) {
            return `Search Results: "${searchQuery}"`;
        }

        // If no search, determine title based on filter parameter
        if (!filter || filter === 'all') return 'Browse All Polls';

        switch (filter) {
            case 'new': return 'New Polls';
            case 'completed': return 'Completed Polls';
            case 'reward': return 'Polls with Rewards';
            // Dynamic titles for demographic filters
            case 'age':
            case 'gender':
            case 'race':
            case 'income':
            case 'pet-owner':
            case 'relationship':
            case 'education':
                return `${filter.charAt(0).toUpperCase() + filter.slice(1).replace('-', ' ')} Related Polls`;
            // Fallback for potentially unrecognized filters (though ideally handled)
            default: return `${filter.charAt(0).toUpperCase() + filter.slice(1)} Polls`;
        }
    };


  // Handler for category dropdown change
  const handleCategoryChange = (e) => {
      const newCategory = e.target.value;
      setCategory(newCategory);
      setPage(1); // Reset page when category changes
      // Update URL to reflect category change if no primary filter is active
      if (!filter || ['all', 'new', 'reward'].includes(filter)) { // Only navigate if filter allows category selection
          const currentSearchParams = new URLSearchParams(location.search);
          if (newCategory) {
              // Maybe add category to URL? Optional.
          } else {
              // Maybe remove category from URL? Optional.
          }
          // If you want category changes to reflect in URL immediately:
          // navigate(`/polls/${filter || 'all'}?${currentSearchParams.toString()}`);
      }
      // The useEffect will pick up the category change and refetch
  };

  // Handler for activeOnly checkbox change
  const handleActiveOnlyChange = (e) => {
      const newActiveOnly = e.target.checked;
      setActiveOnly(newActiveOnly);
      setPage(1); // Reset page when active filter changes
      // The useEffect will pick up the activeOnly change and refetch
  };


  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-4">{getPageTitle()}</h1>

      {/* Added SubNav component */}
      <SubNav nonClickableItems={['live']} />

       {/* Filters and Search Bar moved below SubNav */}
       <div className="bg-white p-4 rounded-lg shadow mt-6 mb-8"> {/* Added mt-6 */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start md:items-end">
             {/* Category Filter Dropdown */}
             {/* Conditionally render category dropdown based on filter */}
             {(!filter || ['all', 'new', 'reward'].includes(filter)) && (
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={handleCategoryChange} // Use specific handler
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  // Disable if a specific category filter is active via URL param
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
            {/* Conditionally render active checkbox based on filter */}
            {filter !== 'completed' && (
                <div className="flex items-center pt-2 sm:pt-0 sm:pb-[2px] sm:mt-1"> {/* Adjusted padding/margin for alignment */}
                 <label className="inline-flex items-center whitespace-nowrap"> {/* Added whitespace-nowrap */}
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                      checked={activeOnly}
                      onChange={handleActiveOnlyChange} // Use specific handler
                      // Disable if the filter forces active state (like 'new' or 'reward') or inactive ('completed')
                      disabled={filter === 'new' || filter === 'reward'}
                    />
                    <span className="ml-2 text-sm text-gray-700">Active polls only</span> {/* Added text size class */}
                  </label>
                </div>
             )}
          </div>

          {/* Search Form */}
          <div className="flex-1 max-w-xs md:max-w-sm lg:max-w-md"> {/* Adjusted max-width */}
            <form onSubmit={handleSearch} className="flex gap-2 items-end"> {/* Use items-end for alignment */}
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
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md py-2" // Added py-2 for consistent height
                />
              </div>
              <button
                type="submit"
                 className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 whitespace-nowrap" // Added whitespace-nowrap
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
      {!loading && polls.length > 0 && totalPages > 1 && ( // Added totalPages > 1 condition
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handlePrevPage}
            disabled={page === 1}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed" // Added disabled cursor style
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={page === totalPages}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed" // Added disabled cursor style
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default PollsList;