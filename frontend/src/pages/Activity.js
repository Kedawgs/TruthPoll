// src/pages/Activity.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import io from 'socket.io-client';
import api from '../utils/api';

const Activity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Connect to WebSocket
  useEffect(() => {
    // Get base URL without /api path
    const socketUrl = process.env.REACT_APP_API_URL 
      ? process.env.REACT_APP_API_URL.replace('/api', '') 
      : 'http://localhost:5000';
    
    const socket = io(socketUrl);
    
    socket.on('connect_error', (err) => {
      setError('Unable to connect to activity feed');
    });
    
    // Listen for activity updates
    socket.on('activity-update', (activity) => {
      setActivities(prev => [activity, ...prev]);
    });
    
    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // Fetch initial activities
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        // Note: Removed the extra /api prefix
        const response = await api.get('/activity');
        
        if (response.data.success) {
          setActivities(response.data.data);
        } else {
          setError('Failed to load activity data');
        }
      } catch (err) {
        setError('Error loading activity feed');
      } finally {
        setLoading(false);
      }
    };
    
    fetchActivities();
  }, []);

  // Format address
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Format time
  const formatTimeAgo = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hr`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)} day`;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Activity</h1>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {/* Loading state */}
      {loading && activities.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="animate-pulse p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                  <div className="ml-3 space-y-1">
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-10"></div>
              </div>
            ))}
          </div>
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          No activity yet
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {activities.map((activity, index) => (
            <div 
              key={activity._id || index} 
              className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-gray-50"
            >
              <div className="flex items-center">
                {/* User avatar/initial */}
                <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                  {activity.avatarUrl ? (
                    <img 
                      src={activity.avatarUrl} 
                      alt="" 
                      className="h-full w-full object-cover" 
                    />
                  ) : (
                    <span className="text-gray-600 font-semibold">
                      {activity.username ? activity.username.charAt(0).toUpperCase() : '#'}
                    </span>
                  )}
                </div>
                
                {/* Activity text */}
                <div className="ml-3">
                  <div className="text-sm">
                    <span className="font-medium">
                      {activity.username || formatAddress(activity.userAddress)}
                    </span>{' '}
                    <span>{activity.type}</span>{' '}
                    <Link 
                      to={`/polls/id/${activity.pollId}`} 
                      className="text-blue-600 hover:underline"
                    >
                      {activity.pollTitle}
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Timestamp */}
              <div className="text-xs text-gray-500">
                {activity.timestamp ? formatTimeAgo(activity.timestamp) : 'just now'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Activity;