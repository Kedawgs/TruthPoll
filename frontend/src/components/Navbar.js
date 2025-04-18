// src/components/Navbar.js
// Updated to include clickable balance with modal

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext'; // Ensure this path is correct
import './Navbar.css'; // Ensure CSS is imported
import Sidebar from './Sidebar'; // Assuming Sidebar component exists
import BalanceModal from './BalanceModal'; // Import the new BalanceModal component
import fullLogo from '../assets/test123.png'; // UPDATE THIS PATH to your actual logo
import api from '../utils/api'; // Assuming api utility exists
import { formatAddress } from '../utils/web3Helper'; // Assuming this helper exists

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Context data - Ensure all needed values are pulled
  const {
    isConnected, account, isAdmin, logout, openAuthModal,
    usdtBalance, refreshUSDTBalance, userProfile // Include setUserProfile if needed elsewhere in Navbar
  } = useAppContext();

  // State
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  // Refs for hover logic and closing dropdowns/search
  const profileHoverTimerRef = useRef(null);
  const profileHoverDelayRef = useRef(null);
  const sidebarHoverTimerRef = useRef(null);
  const sidebarHoverDelayRef = useRef(null);
  const searchInputRef = useRef(null); // Ref for the search input container
  const profileContainerRef = useRef(null); // Ref for the profile container area

  // --- Hover Logic for Profile Dropdown ---
  const handleProfileMouseEnter = () => {
    if (profileHoverTimerRef.current) clearTimeout(profileHoverTimerRef.current);
    profileHoverDelayRef.current = setTimeout(() => {
        setShowProfileDropdown(true);
    }, 150); // Delay before opening
  };

  const handleProfileMouseLeave = () => {
      if (profileHoverDelayRef.current) clearTimeout(profileHoverDelayRef.current);
      profileHoverTimerRef.current = setTimeout(() => {
        setShowProfileDropdown(false);
      }, 250); // Delay before closing
  };

  // Keep dropdown open if mouse enters the dropdown itself
  const handleDropdownMouseEnter = () => {
    if (profileHoverTimerRef.current) clearTimeout(profileHoverTimerRef.current);
  };

  // Close dropdown when mouse leaves the dropdown itself
  const handleDropdownMouseLeave = () => {
    profileHoverTimerRef.current = setTimeout(() => {
      setShowProfileDropdown(false);
    }, 250);
  };
  // --- End Hover Logic for Profile Dropdown ---


  // --- Hover Logic for Sidebar (Mobile/Logged Out) ---
  const handleMenuMouseEnter = () => {
    if (sidebarHoverTimerRef.current) clearTimeout(sidebarHoverTimerRef.current);
    sidebarHoverDelayRef.current = setTimeout(() => setSidebarOpen(true), 200);
  };

  const handleMenuMouseLeave = () => {
    if (sidebarHoverDelayRef.current) clearTimeout(sidebarHoverDelayRef.current);
    sidebarHoverTimerRef.current = setTimeout(() => setSidebarOpen(false), 300);
  };

  const handleSidebarMouseEnter = () => {
    if (sidebarHoverTimerRef.current) clearTimeout(sidebarHoverTimerRef.current);
  };

  const handleSidebarMouseLeave = () => {
    sidebarHoverTimerRef.current = setTimeout(() => setSidebarOpen(false), 300);
  };
  // --- End Hover Logic for Sidebar ---

  // --- Balance Modal Handlers ---
  const handleBalanceClick = () => {
    setShowBalanceModal(true);
  };

  const closeBalanceModal = () => {
    setShowBalanceModal(false);
  };
  // --- End Balance Modal Handlers ---

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (profileHoverTimerRef.current) clearTimeout(profileHoverTimerRef.current);
      if (profileHoverDelayRef.current) clearTimeout(profileHoverDelayRef.current);
      if (sidebarHoverTimerRef.current) clearTimeout(sidebarHoverTimerRef.current);
      if (sidebarHoverDelayRef.current) clearTimeout(sidebarHoverDelayRef.current);
    };
  }, []);


  // Fetch USDT balance effect
  useEffect(() => {
    let intervalId = null;
    if (isConnected && account && refreshUSDTBalance) { // Check if function exists
      refreshUSDTBalance();
      intervalId = setInterval(refreshUSDTBalance, 30000); // Poll every 30s
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isConnected, account, refreshUSDTBalance]);

  // Filter search results effect
  useEffect(() => {
    if (searchResults.length === 0) {
        setFilteredResults([]);
        return;
    }
    if (activeFilter === 'all') {
        setFilteredResults(searchResults);
    } else if (activeFilter === 'active') {
        // Adjust filter logic based on your Poll object structure
        setFilteredResults(searchResults.filter(p => p.onChain?.isActive === true || p.isActive === true));
    } else if (activeFilter === 'ended') {
        setFilteredResults(searchResults.filter(p => p.onChain?.isActive === false || p.isActive === false));
    }
  }, [searchResults, activeFilter]);

  // Handle search query changes effect (with debounce)
  useEffect(() => {
    let timer = null;
    const searchPolls = async () => { // Make async
        if (searchQuery.trim().length < 1) {
            setSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }
        setSearchLoading(true);
        // Clear previous timer if user types quickly
        if (timer) clearTimeout(timer);

        timer = setTimeout(async () => {
            try {
                const response = await api.get(`/polls/search`, { params: { query: searchQuery } });
                if (response.data.success) {
                    setSearchResults(response.data.data.slice(0, 10)); // Limit results
                    setShowSearchDropdown(true);
                } else {
                    setSearchResults([]);
                }
            } catch (error) {
                console.error("Error searching polls:", error);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300); // 300ms debounce
    };

    searchPolls(); // Call the async function

    // Cleanup function
    return () => {
        if (timer) clearTimeout(timer);
    };
  }, [searchQuery]);


  // Click outside to close search dropdown effect
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
          // Check added: Ensure dropdown is not part of the click target
          const dropdownElement = searchInputRef.current.querySelector('.search-dropdown');
          if (!dropdownElement || !dropdownElement.contains(event.target)) {
               setShowSearchDropdown(false);
          }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []); // Empty dependency array means this runs once on mount

  // --- Helper Functions ---
  const handleLogoClick = () => navigate('/');
  const isActive = (path) => location.pathname === path;

  // Gets initial for the main profile circle in navbar
  const getProfileInitial = () => {
    if (userProfile && userProfile.username) {
      return userProfile.username.charAt(0).toUpperCase();
    }
    return account ? account.substring(2, 3).toUpperCase() : '?';
  };


  // Calculates leading percentage for search results
  const calculateLeadingPercentage = (poll) => {
    if (!poll?.onChain?.results || !poll.onChain?.totalVotes || poll.onChain.totalVotes === 0) return 0;
    const maxVotes = Math.max(0, ...poll.onChain.results.map(v => Number(v) || 0)); // Ensure numbers
    return Math.round((maxVotes / Number(poll.onChain.totalVotes)) * 100);
  };

  // Gets leading option text for search results
  const getLeadingOption = (poll) => {
     if (!poll?.onChain?.results || !poll.options || poll.options.length === 0) return '';
     let maxVotes = -1;
     let maxIndex = -1;
     poll.onChain.results.forEach((votes, index) => {
        const numVotes = Number(votes) || 0;
        if (numVotes > maxVotes) {
            maxVotes = numVotes;
            maxIndex = index;
        }
     });
     return poll.options[maxIndex] || '';
  };

  const handleSearchChange = (e) => setSearchQuery(e.target.value);

  // Navigate to poll page from search result
  const handlePollSelect = (pollId) => {
    navigate(`/polls/${pollId}`);
    setShowSearchDropdown(false);
    setSearchQuery('');
  };

  // Navigate to search results page on form submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/polls?search=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchDropdown(false);
      setSearchQuery(''); // Clear search bar after submitting
    }
  };

  // Handle filter change in search dropdown
  const handleFilterChange = (filter) => setActiveFilter(filter);

  // Close profile dropdown when clicking an item inside it
  const handleDropdownClick = () => {
      if (profileHoverTimerRef.current) clearTimeout(profileHoverTimerRef.current);
      setShowProfileDropdown(false);
  };

  // Handle logout action
  const handleLogout = async () => {
    handleDropdownClick(); // Close dropdown first
    if(logout) await logout(); // Call logout from context
    // Navigate to home or login page after logout if needed
    // navigate('/');
  };


  // --- Render ---
  return (
    <>
      <nav className="navbar">
        {/* Left Section: Logo and Search */}
        <div className="navbar-left">
          <div className="logo" onClick={handleLogoClick} title="Home">
            <img src={fullLogo} alt="Logo" className="full-logo" />
          </div>
          {/* Search Bar & Dropdown */}
           <div className="search-bar" ref={searchInputRef}>
             <form onSubmit={handleSearchSubmit}>
               <div className="search-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
               </div>
               <input
                 type="text"
                 placeholder="Search polls"
                 value={searchQuery}
                 onChange={handleSearchChange}
                 onFocus={() => searchQuery.trim().length > 0 && setShowSearchDropdown(true)} // Show dropdown on focus if query exists
                />
             </form>
             {/* Search Dropdown Render Logic */}
             {showSearchDropdown && (
                <div className="search-dropdown">
                    {searchLoading ? (
                        <div className="search-loading"><div className="search-loading-spinner"></div><span>Searching...</span></div>
                    ) : searchResults.length === 0 && searchQuery.trim().length >= 1 ? (
                        <div className="search-no-results">No polls found matching "{searchQuery}"</div>
                    ) : searchResults.length > 0 ? (
                        <>
                            <div className="search-filter-tabs">
                                <button className={`filter-tab ${activeFilter === "all" ? "active" : ""}`} onClick={() => handleFilterChange("all")}>All</button>
                                <button className={`filter-tab ${activeFilter === "active" ? "active" : ""}`} onClick={() => handleFilterChange("active")}>Active</button>
                                <button className={`filter-tab ${activeFilter === "ended" ? "active" : ""}`} onClick={() => handleFilterChange("ended")}>Ended</button>
                            </div>
                            {filteredResults.length > 0 ? (
                                filteredResults.map((poll) => (
                                <div key={poll._id} className="search-result-item" onClick={() => handlePollSelect(poll._id)}>
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
                                <div className="search-no-results">No {activeFilter !== "all" ? activeFilter : ""} polls found matching "{searchQuery}"</div>
                            )}
                            {/* Only show 'View All' if there are results to view */}
                            {(filteredResults.length > 0 || searchResults.length > 0) && (
                                <div className="search-view-all" onClick={(e) => { e.preventDefault(); handleSearchSubmit(e); }}>
                                    View all results for "{searchQuery}"
                                </div>
                            )}
                        </>
                    ) : null }
                </div>
             )}
           </div>
        </div> {/* End navbar-left */}

        {/* Right Section: Nav Items and Auth */}
        <div className="navbar-right">
          {/* Navigation Items */}
          <div className="nav-items">
              <Link to="/polls" className={`nav-item ${isActive("/polls") ? "active" : ""}`}><div className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg></div><span>Polls</span></Link>
              <Link to="/create-poll" className={`nav-item ${isActive("/create-poll") ? "active" : ""}`}><div className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div><span>Create</span></Link>
              <Link to="/leaderboard" className={`nav-item ${isActive("/leaderboard") ? "active" : ""}`}><div className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg></div><span>Leaderboard</span></Link>
              <Link to="/activity" className={`nav-item ${isActive("/activity") ? "active" : ""}`}><div className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg></div><span>Activity</span></Link>
          </div>
          <div className="nav-divider"></div>

          {/* Authentication Section */}
          <div className="auth-section">
            {isConnected && account ? ( // Check for account as well
              // Logged In State
              <div className="user-profile">
                   {/* USDT Balance - UPDATED TO BE CLICKABLE */}
                   {usdtBalance !== null && (
                       <div 
                         className="usdt-balance cursor-pointer hover:bg-gray-200 transition-colors" 
                         title="Click to deposit or withdraw USDT"
                         onClick={handleBalanceClick}
                       >
                           <span>{parseFloat(usdtBalance).toFixed(2)}</span>
                           <span className="usdt-symbol">USDT</span>
                       </div>
                   )}
                   {/* Notification Icon (Placeholder) */}
                   <div className="notification-icon" title="Notifications">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                       {/* <span className="notification-badge">2</span> Example badge */}
                   </div>

                {/* Profile Area (Trigger + Dropdown) */}
                <div
                    className="profile-container"
                    ref={profileContainerRef}
                    onMouseLeave={handleProfileMouseLeave}
                >
                    {/* Profile Trigger (Circle + Chevron) */}
                    <div
                        className="profile-trigger flex items-center cursor-pointer" // Use Tailwind or your own CSS
                        onMouseEnter={handleProfileMouseEnter}
                        title="Profile Menu"
                    >
                        {/* Profile Circle (Avatar or Initial) */}
                        <div className="profile-circle overflow-hidden">
                            {userProfile && userProfile.avatarUrl ? (
                                <img
                                    src={userProfile.avatarUrl}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                    onError={(e) => { console.warn('Navbar avatar load error'); e.target.style.display='none'; }} // Hide if fails
                                />
                            ) : (
                                <span>{getProfileInitial()}</span>
                            )}
                        </div>
                        {/* Chevron Icon */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 ml-1 text-gray-400 profile-chevron" // Use Tailwind or your own CSS
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            style={{ transition: 'transform 0.2s', transform: showProfileDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    {/* --- Profile Dropdown Menu --- */}
                    {/* Uses 'open' class for visibility controlled by CSS */}
                    <div
                        className={`profile-dropdown ${showProfileDropdown ? 'open' : ''}`}
                        onMouseEnter={handleDropdownMouseEnter}
                        onMouseLeave={handleDropdownMouseLeave}
                    >
                        {/* --- Dropdown Header with Avatar --- */}
                        <div className="dropdown-header"> {/* Style with display:flex; align-items:center; */}
                            {/* Conditionally render the avatar image */}
                            {userProfile?.avatarUrl && (
                                <img
                                    src={userProfile.avatarUrl}
                                    alt="Avatar"
                                    className="dropdown-header-avatar" // Needs CSS: size, border-radius, margin-right
                                    onError={(e) => { console.warn('Dropdown avatar load error'); e.target.style.display='none'; }} // Optional
                                />
                            )}
                            {/* Username or Address */}
                            <div className="dropdown-address" title={account || ''}>
                                {userProfile?.username || formatAddress(account)}
                            </div>
                        </div>
                        {/* --- End Dropdown Header --- */}

                        <div className="dropdown-divider"></div>

                        {/* Dropdown Links */}
                        <Link to="/profile" className="dropdown-item" onClick={handleDropdownClick}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          Profile
                        </Link>
                        <Link to="/rewards" className="dropdown-item" onClick={handleDropdownClick}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                          Rewards
                        </Link>

                        {/* Admin Section (Conditional) */}
                        {isAdmin === true && (
                             <>
                                 <div className="dropdown-divider"></div>
                                 <div className="dropdown-header">
                                     {/* Use appropriate class for styling */}
                                     <div className="text-purple-600 font-medium"> Admin Controls </div>
                                 </div>
                                 <Link to="/admin/dashboard" className="dropdown-item" onClick={handleDropdownClick}>
                                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                                     Admin Dashboard
                                 </Link>
                                 <Link to="/admin/config" className="dropdown-item" onClick={handleDropdownClick}>
                                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
                                     Configuration
                                 </Link>
                             </>
                        )}
                        {/* Logout Button */}
                        <button className="dropdown-item logout-button" onClick={handleLogout}>
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                             Sign Out
                        </button>
                    </div> {/* End profile-dropdown */}
                </div> {/* End profile-container */}

              </div> // End user-profile
            ) : (
              // Logged Out State
              <>
                <button onClick={openAuthModal} className="btn btn-outline"> Login </button>
                <button onClick={openAuthModal} className="btn btn-primary"> Sign Up </button>
              </>
            )}
          </div> {/* End auth-section */}

          {/* Hamburger Menu (Only show when logged out and likely on smaller screens - controlled by CSS) */}
          {!isConnected && (
             <div className="menu-button" onMouseEnter={handleMenuMouseEnter} onMouseLeave={handleMenuMouseLeave}>
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
             </div>
          )}
        </div> {/* End navbar-right */}
      </nav>

      {/* Sidebar Component */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      />

      {/* Balance Modal */}
      {showBalanceModal && (
        <BalanceModal
          isOpen={showBalanceModal}
          onClose={closeBalanceModal}
          refreshBalance={refreshUSDTBalance}
        />
      )}
    </>
  );
};

export default Navbar;