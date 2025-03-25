// Final Navbar.js implementation
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';
import truthPollLogo from '../assets/TruthPoll-logo.png';

const Navbar = ({ isLoggedIn, userAccount, logout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleLogoClick = () => {
    navigate('/');
  };
  
  // Function to determine if a nav link is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="navbar">
      {/* Left Section - Logo & Search */}
      <div className="navbar-left">
        <div className="logo" onClick={handleLogoClick}>
          <img 
            src={truthPollLogo} 
            alt="TruthPoll Logo" 
            className="logo-icon" 
          />
          <span>TruthPoll</span>
        </div>
        <div className="search-bar">
          <div className="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input type="text" placeholder="Search" />
        </div>
      </div>

      {/* Right Section - Contains Nav Items, Auth, and Menu */}
      <div className="navbar-right">
        {/* Navigation Items Group */}
        <div className="nav-items">
          <Link to="/polls" className={`nav-item ${isActive('/polls') ? 'active' : ''}`}>
            <div className="nav-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20v-6M6 20V10M18 20V4"></path>
              </svg>
            </div>
            <span>Polls</span>
          </Link>
          
          {/* Create icon */}
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
        
        {/* Divider */}
        <div className="nav-divider"></div>
        
        {/* Auth Section */}
        <div className="auth-section">
          {isLoggedIn ? (
            <>
              <div className="user-account">
                {userAccount && formatAddress(userAccount)}
              </div>
              <button className="btn btn-outline" onClick={logout}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="btn btn-outline">Login</button>
              </Link>
              <Link to="/signup">
                <button className="btn btn-primary">Sign Up</button>
              </Link>
            </>
          )}
        </div>
        
        {/* Hamburger Menu Button */}
        <div className="menu-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </div>
      </div>
    </nav>
  );
};

// Helper function to format Ethereum addresses
const formatAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export default Navbar;