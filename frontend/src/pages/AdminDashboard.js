// frontend/src/pages/AdminDashboard.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import api from '../utils/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isConnected, account } = useAppContext();
  const [stats, setStats] = useState({
    totalPolls: 0,
    totalUsers: 0,
    totalVotes: 0,
    totalRewards: 0
  });
  const [loading, setLoading] = useState(true);
  const [adminVerified, setAdminVerified] = useState(false);
  
  // Verify admin status directly with the backend
  const verifyAdmin = async () => {
    try {
      // Use the public endpoint instead of the authenticated one
      const response = await api.get(`/auth/is-address-admin/${account}`);
      if (!response.data.success || !response.data.data.isAdmin) {
        // User is not an admin, redirect to home
        console.log("User is not an admin, redirecting to home");
        navigate('/');
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error verifying admin status:", error);
      navigate('/');
      return false;
    }
  };
  
  // src/pages/AdminDashboard.js - Add missing dependency
  useEffect(() => {
    if (!isConnected || !account) {
      navigate('/');
      return;
    }
    
    const checkAdminStatus = async () => {
      setLoading(true);
      const isVerified = await verifyAdmin();
      setAdminVerified(isVerified);
      setLoading(false);
    };
    
    checkAdminStatus();
    
    // Load mock stats for demo
    setTimeout(() => {
      setStats({
        totalPolls: 45,
        totalUsers: 127,
        totalVotes: 532,
        totalRewards: 250
      });
    }, 1000);
  }, [isConnected, account, navigate, verifyAdmin]);
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }
  
  if (!adminVerified) {
    return null; // Will redirect in useEffect
  }
  
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-6">
          <div className="bg-purple-100 p-3 rounded-full mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Administrative Functions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Admin Function Cards */}
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <Link to="/admin/config" className="block">
                <h3 className="font-medium text-gray-900 mb-2">Configuration Management</h3>
                <p className="text-sm text-gray-500">Manage application configuration values and settings.</p>
              </Link>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-medium text-gray-900 mb-2">Deploy Factory Contract</h3>
              <p className="text-sm text-gray-500">Deploy or update the poll factory contract.</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-medium text-gray-900 mb-2">Manage USDT</h3>
              <p className="text-sm text-gray-500">Handle token funding and distributions.</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-medium text-gray-900 mb-2">User Management</h3>
              <p className="text-sm text-gray-500">View and manage user accounts.</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-medium text-gray-900 mb-2">Poll Moderation</h3>
              <p className="text-sm text-gray-500">Moderate and manage existing polls.</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-medium text-gray-900 mb-2">System Logs</h3>
              <p className="text-sm text-gray-500">View application logs and diagnostics.</p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">System Status</h2>
          
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  All systems operational
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xl font-semibold">{stats.totalPolls}</div>
              <div className="text-sm text-gray-500">Total Polls</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xl font-semibold">{stats.totalUsers}</div>
              <div className="text-sm text-gray-500">Users</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xl font-semibold">{stats.totalVotes}</div>
              <div className="text-sm text-gray-500">Votes Cast</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xl font-semibold">{stats.totalRewards} USDT</div>
              <div className="text-sm text-gray-500">Rewards Distributed</div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Admin Information</h2>
          
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-sm text-blue-800 mb-2">
              <span className="font-medium">Admin Address:</span> {account}
            </p>
            <p className="text-sm text-blue-800">
              You have full administrative access to the TruthPoll platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;