// SubNav.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SubNav.css';

const SubNav = ({ onTabChange, nonClickableItems = [] }) => {
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();
  
  const navItems = [
    { id: 'live', label: 'Live', hasIndicator: true, tooltip: 'Website status monitor' },
    { id: 'all', label: 'All', tooltip: 'View all polls' },
    { id: 'new', label: 'New', tooltip: 'Recently created polls' },
    { id: 'completed', label: 'Completed', tooltip: 'Polls that have ended' },
    { id: 'reward', label: 'Reward', tooltip: 'Polls offering rewards' },
    { id: 'age', label: 'Age', tooltip: 'Age-based polls' },
    { id: 'gender', label: 'Gender', tooltip: 'Gender-based polls' },
    { id: 'race', label: 'Race', tooltip: 'Race-based polls' },
    { id: 'income', label: 'Income', tooltip: 'Income-based polls' },
    { id: 'pet-owner', label: 'Pet Owner', tooltip: 'Pet ownership polls' },
    { id: 'relationship', label: 'Relationship', tooltip: 'Relationship status polls' },
    { id: 'education', label: 'Education', tooltip: 'Education-based polls' }
  ];
  
  const handleTabClick = (id) => {
    if (nonClickableItems.includes(id)) {
      return;
    }
    
    setActiveTab(id);
    
    // Call the onTabChange callback if provided
    if (onTabChange) {
      onTabChange(id);
    }
    
    // Navigate to the corresponding URL
    navigate(`/polls/${id}`);
  };
  
  return (
    <div className="subnav-container">
      <div className="subnav-scroll-container">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className={`subnav-item ${activeTab === item.id ? 'active' : ''} ${
              nonClickableItems.includes(item.id) ? 'non-clickable' : ''
            }`}
            disabled={nonClickableItems.includes(item.id)}
            title={item.tooltip}
          >
            <div className="subnav-item-content">
              {item.hasIndicator && (
                <span className="live-indicator"></span>
              )}
              <span>{item.label}</span>
            </div>
            {activeTab === item.id && !nonClickableItems.includes(item.id) && (
              <div className="active-indicator"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SubNav;