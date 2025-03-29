// src/components/Navbar.js
import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Web3Context } from '../context/Web3Context';
import './Navbar.css';
import Sidebar from './Sidebar';
import fullLogo from '../assets/test123.png'; // Update this path to your actual image file
import api from '../utils/api';

const Navbar = ({ isLoggedIn, userAccount, logout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hoverTimerRef = useRef(null);
  const hoverDelayRef = useRef(null);
  const searchInputRef = useRef(null);
  const { getUSDTBalance, openAuthModal } = useContext(Web3Context);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'active', or 'ended'
  
  // Handle mouse enter on hamburger menu
  const handleMenuMouseEnter = () => {
    // Clear any existing timers
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    
    // Small delay before showing sidebar (prevents accidental triggers)
    hoverDelayRef.current = setTimeout(() => {
      setSidebarOpen(true);
    }, 200); // 200ms delay before showing
  };

  // Handle mouse leave on hamburger menu
  const handleMenuMouseLeave = () => {
    // Clear the show delay if it exists
    if (hoverDelayRef.current) {
      clearTimeout(hoverDelayRef.current);
      hoverDelayRef.current = null;
    }
    
    // Set a timer to close the sidebar if the mouse doesn't enter it
    hoverTimerRef.current = setTimeout(() => {
      setSidebarOpen(false);
    }, 300); // 300ms grace period to move to sidebar
  };

  // Handle sidebar mouse enter
  const handleSidebarMouseEnter = () => {
    // Clear the close timer if it exists
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  // Handle sidebar mouse leave
  const handleSidebarMouseLeave = () => {
    // Close the sidebar after a short delay
    hoverTimerRef.current = setTimeout(() => {
      setSidebarOpen(false);
    }, 300); // 300ms delay before hiding
  };

  // Clean up timers when component unmounts
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
      if (hoverDelayRef.current) {
        clearTimeout(hoverDelayRef.current);
      }
    };
  }, []);
  
  // Fetch USDT balance when user is logged in
  useEffect(() => {
    const fetchBalance = async () => {
      if (isLoggedIn && userAccount) {
        try {
          // Use getUSDTBalance from context which should now use smart wallets
          const balance = await getUSDTBalance(userAccount);
          setUsdtBalance(balance || "0.00");
        } catch (error) {
          console.error("Error fetching USDT balance:", error);
          setUsdtBalance("0.00");
        }
      }
    };
    
    fetchBalance();
    
    // Poll for balance updates every 30 seconds
    const intervalId = setInterval(fetchBalance, 30000);
    
    return () => clearInterval(intervalId);
  }, [isLoggedIn, userAccount, getUSDTBalance]);
  
  // Filter results based on active filter
  useEffect(() => {
    if (searchResults.length === 0) {
      setFilteredResults([]);
      return;
    }

    if (activeFilter === 'all') {
      setFilteredResults(searchResults);
    } else if (activeFilter === 'active') {
      setFilteredResults(searchResults.filter(poll => 
        poll.onChain?.isActive === true || poll.isActive === true
      ));
    } else if (activeFilter === 'ended') {
      setFilteredResults(searchResults.filter(poll => 
        poll.onChain?.isActive === false || poll.isActive === false
      ));
    }
  }, [searchResults, activeFilter]);
  
  // Handle search query changes
  useEffect(() => {
    const searchPolls = async () => {
      if (searchQuery.trim().length < 1) {
        setSearchResults([]);
        setShowSearchDropdown(false);
        return;
      }

      setSearchLoading(true);
      
      try {
        // Debounce search
        const timer = setTimeout(async () => {
          const response = await api.get(`/polls/search`, {
            params: { query: searchQuery }
          });
          
          if (response.data.success) {
            setSearchResults(response.data.data.slice(0, 10)); // Limit to top 10 results
            setShowSearchDropdown(true);
          } else {
            setSearchResults([]);
          }
          setSearchLoading(false);
        }, 300);

        return () => clearTimeout(timer);
      } catch (error) {
        console.error("Error searching polls:", error);
        setSearchResults([]);
        setSearchLoading(false);
      }
    };

    searchPolls();
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleLogoClick = () => {
    navigate('/');
  };
  
  // Function to determine if a nav link is active
  const isActive = (path) => {
    return location.pathname === path;
  };
  
  // Get first character of address for profile circle
  const getProfileInitial = (address) => {
    if (!address) return '?';
    return address.substring(2, 3).toUpperCase();
  };
  
  // Toggle profile dropdown
  const toggleProfileDropdown = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.profile-container')) {
        setShowProfileDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Calculate percentage for leading option in a poll
  const calculateLeadingPercentage = (poll) => {
    if (!poll?.onChain?.results || !poll.onChain?.totalVotes) return 0;
    
    // Find the option with the most votes
    const maxVotes = Math.max(...poll.onChain.results);
    if (maxVotes === 0) return 0;
    
    return Math.round((maxVotes / poll.onChain.totalVotes) * 100);
  };

  // Get the leading option text
  const getLeadingOption = (poll) => {
    if (!poll?.onChain?.results || !poll.options) return '';
    
    // Find the index of the option with the most votes
    const maxIndex = poll.onChain?.results.indexOf(Math.max(...poll.onChain.results));
    return poll.options[maxIndex];
  };

  // Handle search input changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle search poll selection
  const handlePollSelect = (pollId) => {
    navigate(`/polls/${pollId}`);
    setShowSearchDropdown(false);
    setSearchQuery('');
  };

  // Handle search form submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/polls?search=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchDropdown(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  return (
    <>
      <nav className="navbar">
        {/* Left Section - Logo & Search */}
        <div className="navbar-left">
          <div className="logo" onClick={handleLogoClick}>
            <img 
              src={fullLogo} 
              alt="TruthPoll Logo" 
              className="full-logo" 
            />
          </div>
          <div className="search-bar" ref={searchInputRef}>
            <form onSubmit={handleSearchSubmit}>
              <div className="search-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="Search polls" 
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </form>
            
            {/* Search Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="search-dropdown">
                {/* Filter Tabs */}
                <div className="search-filter-tabs">
                  <button 
                    className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('all')}
                  >
                    All
                  </button>
                  <button 
                    className={`filter-tab ${activeFilter === 'active' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('active')}
                  >
                    Active
                  </button>
                  <button 
                    className={`filter-tab ${activeFilter === 'ended' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('ended')}
                  >
                    Ended
                  </button>
                </div>
                
                {/* Filter Results */}
                {filteredResults.length > 0 ? (
                  filteredResults.map((poll) => (
                    <div 
                      key={poll._id} 
                      className="search-result-item"
                      onClick={() => handlePollSelect(poll._id)}
                    >
                      <div className="search-result-content">
                        <div className="search-result-title">{poll.title}</div>
                        <div className="search-result-category">{poll.category}</div>
                      </div>
                      <div className="search-result-percentage">
                        <span className="percentage-value">{calculateLeadingPercentage(poll)}%</span>
                        <span className="percentage-label">{getLeadingOption(poll)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="search-no-results">
                    No {activeFilter !== 'all' ? activeFilter : ''} polls found matching "{searchQuery}"
                  </div>
                )}
                
                {/* View All Results Link */}
                {filteredResults.length > 0 && (
                  <div 
                    className="search-view-all"
                    onClick={() => {
                      navigate(`/polls?search=${encodeURIComponent(searchQuery.trim())}`);
                      setShowSearchDropdown(false);
                      setSearchQuery('');
                    }}
                  >
                    View all results
                  </div>
                )}
              </div>
            )}
            
            {/* No Results State */}
            {showSearchDropdown && searchQuery.trim().length >= 1 && searchResults.length === 0 && !searchLoading && (
              <div className="search-dropdown">
                <div className="search-no-results">
                  No polls found matching "{searchQuery}"
                </div>
              </div>
            )}
            
            {/* Loading State */}
            {searchLoading && searchQuery.trim().length >= 1 && (
              <div className="search-dropdown">
                <div className="search-loading">
                  <div className="search-loading-spinner"></div>
                  <span>Searching...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Nav Items, Auth/Profile */}
        <div className="navbar-right">
          <div className="nav-items">
            <Link to="/polls" className={`nav-item ${isActive('/polls') ? 'active' : ''}`}>
              <div className="nav-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20v-6M6 20V10M18 20V4"></path>
                </svg>
              </div>
              <span>Polls</span>
            </Link>
            
            <Link to="/create-poll" className={`nav-item ${isActive('/create-poll') ? 'active' : ''}`}>
              <div className="nav-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <span>Create</span>
            </Link>
            
            <Link to="/leaderboard" className={`nav-item ${isActive('/leaderboard') ? 'active' : ''}`}>
              <div className="nav-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="7"></circle>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                </svg>
              </div>
              <span>Leaderboard</span>
            </Link>
            
            <Link to="/activity" className={`nav-item ${isActive('/activity') ? 'active' : ''}`}>
              <div className="nav-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </div>
              <span>Activity</span>
            </Link>
          </div>
          
          <div className="nav-divider"></div>
          
          <div className="auth-section">
            {isLoggedIn ? (
              <div className="user-profile">
                {/* USDT Balance */}
                <div className="usdt-balance">
                  <span>{usdtBalance}</span>
                  <span className="usdt-symbol">USDT</span>
                </div>
                
                {/* Notification Icon */}
                <div className="notification-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  <span className="notification-badge">2</span>
                </div>
                
                {/* Profile Circle */}
                <div className="profile-container">
                  <div 
                    className="profile-circle"
                    onClick={toggleProfileDropdown}
                  >
                    {getProfileInitial(userAccount)}
                  </div>
                  
                  {/* Profile Dropdown */}
                  {showProfileDropdown && (
                    <div className="profile-dropdown">
                      <div className="dropdown-header">
                        <div className="dropdown-address">{formatAddress(userAccount)}</div>
                      </div>
                      <div className="dropdown-divider"></div>
                      <Link to="/profile" className="dropdown-item">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Profile
                      </Link>
                      <Link to="/rewards" className="dropdown-item">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polygon points="10 8 16 12 10 16 10 8"></polygon>
                        </svg>
                        Rewards
                      </Link>
                      <button className="dropdown-item" onClick={logout}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <button onClick={openAuthModal} className="btn btn-outline">Login</button>
                <button onClick={openAuthModal} className="btn btn-primary">Sign Up</button>
              </>
            )}
          </div>
          
          {/* Only show hamburger menu when not logged in */}
          {!isLoggedIn && (
            <div 
              className="menu-button"
              onMouseEnter={handleMenuMouseEnter}
              onMouseLeave={handleMenuMouseLeave}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </div>
          )}
        </div>
      </nav>
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      />
    </>
  );
};

export default Navbar;