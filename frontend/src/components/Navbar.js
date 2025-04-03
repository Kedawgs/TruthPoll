// src/components/Navbar.js
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import './Navbar.css'; // Ensure CSS is imported
import Sidebar from './Sidebar';
import fullLogo from '../assets/test123.png'; // UPDATE THIS PATH
import api from '../utils/api';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Context data
  const {
    isConnected, account, isAdmin, logout, openAuthModal,
    usdtBalance, refreshUSDTBalance, userProfile
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

  // Refs for hover logic and closing dropdowns
  const profileHoverTimerRef = useRef(null);
  const profileHoverDelayRef = useRef(null); // Optional delay before opening
  const sidebarHoverTimerRef = useRef(null);
  const sidebarHoverDelayRef = useRef(null);
  const searchInputRef = useRef(null);
  const profileContainerRef = useRef(null); // Ref for the profile container area

  // --- Hover Logic for Profile Dropdown ---
  const handleProfileMouseEnter = () => {
    if (profileHoverTimerRef.current) clearTimeout(profileHoverTimerRef.current);
    // Optional: Add a small delay before opening to prevent accidental triggers
    profileHoverDelayRef.current = setTimeout(() => {
       setShowProfileDropdown(true);
    }, 150); // Adjust delay as needed (e.g., 150ms)
  };

  const handleProfileMouseLeave = () => {
     // Clear any pending open delay
     if (profileHoverDelayRef.current) clearTimeout(profileHoverDelayRef.current);
     // Set a timer to close the dropdown after a short delay
     // This allows the user time to move their mouse onto the dropdown itself
     profileHoverTimerRef.current = setTimeout(() => {
       setShowProfileDropdown(false);
     }, 250); // Adjust delay as needed (e.g., 250ms)
  };

  // Keep dropdown open if mouse enters the dropdown itself
  const handleDropdownMouseEnter = () => {
    // When the mouse enters the dropdown, clear the timer that would close it
    if (profileHoverTimerRef.current) clearTimeout(profileHoverTimerRef.current);
  };

  // Close dropdown when mouse leaves the dropdown itself
  const handleDropdownMouseLeave = () => {
    // Start the timer to close the dropdown when the mouse leaves it
    profileHoverTimerRef.current = setTimeout(() => {
      setShowProfileDropdown(false);
    }, 250); // Adjust delay as needed
  };
  // --- End Hover Logic for Profile Dropdown ---


  // --- Hover Logic for Sidebar (Existing) ---
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
    if (isConnected && account) {
      refreshUSDTBalance();
      intervalId = setInterval(refreshUSDTBalance, 30000); // Poll every 30s
    }
    return () => {
      if (intervalId) clearInterval(intervalId); // Clear interval on disconnect/unmount
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
        setFilteredResults(searchResults.filter(p => p.onChain?.isActive === true || p.isActive === true));
    } else if (activeFilter === 'ended') {
        setFilteredResults(searchResults.filter(p => p.onChain?.isActive === false || p.isActive === false));
    }
  }, [searchResults, activeFilter]);

  // Handle search query changes effect (with debounce)
  useEffect(() => {
    let timer = null;
    const searchPolls = () => {
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
    searchPolls();
    // Cleanup function to clear timer if component unmounts or query changes
    return () => {
        if (timer) clearTimeout(timer);
    };
  }, [searchQuery]);


  // Click outside to close search dropdown effect
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close search dropdown if click is outside search bar/dropdown
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        // Check if click is also outside the dropdown itself if it exists
        const dropdown = searchInputRef.current.querySelector('.search-dropdown');
        if (!dropdown || !dropdown.contains(event.target)) {
             setShowSearchDropdown(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []); // Dependency array is empty, runs once

  // --- Helper Functions ---
  const handleLogoClick = () => navigate('/');
  const isActive = (path) => location.pathname === path;

  const getProfileInitial = () => {
    if (!account) return '?';
    if (userProfile && userProfile.username) return userProfile.username.charAt(0).toUpperCase();
    return account.substring(2, 3).toUpperCase(); // Use char from address
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const calculateLeadingPercentage = (poll) => {
    if (!poll?.onChain?.results || !poll.onChain?.totalVotes) return 0;
    const maxVotes = Math.max(...poll.onChain.results);
    if (poll.onChain.totalVotes === 0) return 0; // Avoid division by zero
    return Math.round((maxVotes / poll.onChain.totalVotes) * 100);
  };

  const getLeadingOption = (poll) => {
    if (!poll?.onChain?.results || !poll.options || poll.options.length === 0) return '';
    let maxVotes = -1;
    let maxIndex = -1;
    // Handle potential sparse arrays or different lengths (safer loop)
    for (let i = 0; i < poll.onChain.results.length; i++) {
        if (poll.onChain.results[i] > maxVotes) {
            maxVotes = poll.onChain.results[i];
            maxIndex = i;
        }
    }
    return poll.options[maxIndex] || ''; // Return option text or empty string
  };

  const handleSearchChange = (e) => setSearchQuery(e.target.value);

  const handlePollSelect = (pollId) => {
    navigate(`/polls/${pollId}`);
    setShowSearchDropdown(false);
    setSearchQuery('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/polls?search=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchDropdown(false);
    }
  };

  const handleFilterChange = (filter) => setActiveFilter(filter);

  // Close dropdown when clicking an item inside it
  const handleDropdownClick = () => {
      if (profileHoverTimerRef.current) clearTimeout(profileHoverTimerRef.current); // Clear any closing timer
      setShowProfileDropdown(false); // Close immediately
  };

  const handleLogout = async () => {
    handleDropdownClick(); // Close dropdown first
    await logout();
    // Navigation might be handled by context/app state changes, or add navigate('/') if needed
  };


  // --- Render ---
  return (
    <>
      <nav className="navbar">
        {/* Left Section */}
        <div className="navbar-left">
          <div className="logo" onClick={handleLogoClick}>
            <img src={fullLogo} alt="TruthPoll Logo" className="full-logo" />
          </div>
          {/* --- Search Bar --- */}
           <div className="search-bar" ref={searchInputRef}>
             <form onSubmit={handleSearchSubmit}>
               <div className="search-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
               </div>
               <input type="text" placeholder="Search polls" value={searchQuery} onChange={handleSearchChange} />
             </form>
             {/* --- Search Dropdown Render Logic --- */}
                {showSearchDropdown && searchResults.length > 0 && (
                   <div className="search-dropdown">
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
                     ) : ( <div className="search-no-results">No {activeFilter !== "all" ? activeFilter : ""} polls found matching "{searchQuery}"</div> )}
                     {filteredResults.length > 0 && (
                       <div className="search-view-all" onClick={() => { navigate(`/polls?search=${encodeURIComponent(searchQuery.trim())}`); setShowSearchDropdown(false); setSearchQuery(""); }}> View all results </div>
                     )}
                   </div>
                )}
                {showSearchDropdown && searchQuery.trim().length >= 1 && searchResults.length === 0 && !searchLoading && (
                    <div className="search-dropdown"> <div className="search-no-results">No polls found matching "{searchQuery}"</div> </div>
                )}
                {searchLoading && searchQuery.trim().length >= 1 && (
                    <div className="search-dropdown"> <div className="search-loading"><div className="search-loading-spinner"></div><span>Searching...</span></div> </div>
                )}
           </div>
        </div> {/* End navbar-left */}

        {/* Right Section */}
        <div className="navbar-right">
          {/* --- Nav Items --- */}
          <div className="nav-items">
             <Link to="/polls" className={`nav-item ${isActive("/polls") ? "active" : ""}`}><div className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg></div><span>Polls</span></Link>
             <Link to="/create-poll" className={`nav-item ${isActive("/create-poll") ? "active" : ""}`}><div className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div><span>Create</span></Link>
             <Link to="/leaderboard" className={`nav-item ${isActive("/leaderboard") ? "active" : ""}`}><div className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg></div><span>Leaderboard</span></Link>
             <Link to="/activity" className={`nav-item ${isActive("/activity") ? "active" : ""}`}><div className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg></div><span>Activity</span></Link>
          </div>
          <div className="nav-divider"></div>

          {/* --- Auth Section --- */}
          <div className="auth-section">
            {isConnected ? (
              <div className="user-profile">
                 {/* --- USDT Balance --- */}
                 <div className="usdt-balance">
                     <span>{usdtBalance}</span>
                     <span className="usdt-symbol">USDT</span>
                 </div>
                 {/* --- Notification Icon --- */}
                 <div className="notification-icon">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                     <span className="notification-badge">2</span> {/* Example badge */}
                 </div>

                {/* --- Profile Area (Container for Hover Logic) --- */}
                <div
                    className="profile-container"
                    ref={profileContainerRef} // Ref for potential future use (e.g., click outside)
                    onMouseLeave={handleProfileMouseLeave} // Attach leave handler to the container
                >
                    {/* --- Clickable Trigger (Circle + Chevron) --- */}
                    <div
                        // Use CSS class OR Tailwind classes below:
                        // className="profile-trigger" // Your CSS class
                        className="profile-trigger flex items-center cursor-pointer" // Tailwind classes (ensure Tailwind is configured)
                        onMouseEnter={handleProfileMouseEnter} // Attach enter handler
                    >
                        <div className="profile-circle overflow-hidden">
                            {userProfile && userProfile.avatarUrl ? (
                                <img 
                                    src={userProfile.avatarUrl} 
                                    alt="Profile" 
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span>{getProfileInitial()}</span>
                            )}
                        </div>
                        {/* --- Chevron Icon --- */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                             // Use CSS class OR Tailwind classes below:
                            // className={`profile-chevron ${showProfileDropdown ? 'open' : ''}`} // Your CSS class
                            className="h-4 w-4 ml-1 text-gray-400" // Tailwind classes
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            // Apply rotation dynamically based on state
                            style={{
                                transition: 'transform 0.2s ease-in-out',
                                transform: showProfileDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    {/* --- Profile Dropdown Menu --- */}
                    <div
                        className={`profile-dropdown ${showProfileDropdown ? 'open' : ''}`} // Add 'open' class based on state for CSS transitions
                        onMouseEnter={handleDropdownMouseEnter} // Keep open
                        onMouseLeave={handleDropdownMouseLeave} // Close when leaving dropdown
                    >
                         {/* --- Dropdown Content --- */}
                         <div className="dropdown-header">
                             <div className="dropdown-address" title={account || ''}> {/* Add title for full address on hover */}
                                {userProfile?.username || formatAddress(account)}
                             </div>
                         </div>
                         <div className="dropdown-divider"></div>
                         {/* Links - Use handleDropdownClick to close on navigate */}
                         <Link to="/profile" className="dropdown-item" onClick={handleDropdownClick}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            Profile
                         </Link>
                         <Link to="/rewards" className="dropdown-item" onClick={handleDropdownClick}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                            Rewards
                         </Link>

                         {/* --- Admin Section --- */}
                         {isAdmin === true && (
                             <>
                                 <div className="dropdown-divider"></div>
                                 <div className="dropdown-header">
                                     {/* You might want a CSS class for this instead of Tailwind */}
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
                         {/* --- Logout Button --- */}
                         <button className="dropdown-item" onClick={handleLogout}>
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                             Sign Out
                         </button>
                    </div>
                </div> {/* End profile-container */}

              </div> // End user-profile
            ) : (
              <> {/* --- Logged Out Buttons --- */}
                <button onClick={openAuthModal} className="btn btn-outline"> Login </button>
                <button onClick={openAuthModal} className="btn btn-primary"> Sign Up </button>
              </>
            )}
          </div> {/* End auth-section */}

          {/* --- Hamburger Menu (Logged Out Only) --- */}
          {!isConnected && (
             <div className="menu-button" onMouseEnter={handleMenuMouseEnter} onMouseLeave={handleMenuMouseLeave}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
             </div>
          )}
        </div> {/* End navbar-right */}
      </nav>

      {/* --- Sidebar --- */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onMouseEnter={handleSidebarMouseEnter} onMouseLeave={handleSidebarMouseLeave} />
    </>
  );
};

export default Navbar;