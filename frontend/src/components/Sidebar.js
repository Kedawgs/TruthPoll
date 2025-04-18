// src/components/Sidebar.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, onMouseEnter, onMouseLeave }) => {
  const navigate = useNavigate();
  const { isConnected, openAuthModal } = useAppContext();
  const [lightMode, setLightMode] = useState(false);
  
  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };
  
  const handleCreatePoll = () => {
    if (isConnected) {
      handleNavigation('/create-poll');
    } else {
      openAuthModal();
      onClose();
    }
  };
  
  const toggleLightMode = () => {
    setLightMode(!lightMode);
    // Here you would implement the actual theme change logic
    // document.body.classList.toggle('light-mode');
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="sidebar-container">
      <div 
        className="sidebar"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Gradient Create Poll Button */}
        <button 
          className="sidebar-create-btn"
          onClick={handleCreatePoll}
        >
          Create Poll
        </button>
        
        {/* Navigation Menu Items */}
        <div className="sidebar-nav">
          <button 
            className="sidebar-nav-item"
            onClick={() => handleNavigation('/polls')}
          >
            <div className="sidebar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20v-6M6 20V10M18 20V4"></path>
              </svg>
            </div>
            <span>Polls</span>
          </button>
          
          <button 
            className="sidebar-nav-item"
            onClick={() => handleNavigation('/activity')}
          >
            <div className="sidebar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
            </div>
            <span>Activity</span>
          </button>
          
          <button 
            className="sidebar-nav-item"
            onClick={() => handleNavigation('/leaderboard')}
          >
            <div className="sidebar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="7"></circle>
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
              </svg>
            </div>
            <span>Leaderboard</span>
          </button>
          
          {/* Light Mode Toggle */}
          <div className="sidebar-nav-item light-mode-toggle">
            <div className="sidebar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            </div>
            <span>Light Mode</span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={lightMode} 
                onChange={toggleLightMode}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
        
        {/* Auth Buttons */}
        {!isConnected && (
          <div className="sidebar-auth">
            <button 
              className="sidebar-login-btn"
              onClick={() => {
                openAuthModal();
                onClose();
              }}
            >
              Login
            </button>
            <button 
              className="sidebar-signup-btn"
              onClick={() => {
                openAuthModal();
                onClose();
              }}
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;