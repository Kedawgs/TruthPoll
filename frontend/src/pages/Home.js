// src/pages/Home.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import PollCard from '../components/PollCard';

const Home = () => {
  const [recentPolls, setRecentPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getPolls, isConnected, openAuthModal } = useAppContext();

  useEffect(() => {
    const fetchRecentPolls = async () => {
      try {
        setLoading(true);
        const result = await getPolls({ limit: 3, sortBy: 'createdAt', sortOrder: 'desc' });
        setRecentPolls(result.data);
      } catch (error) {
        console.error('Error fetching recent polls:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentPolls();
  }, [getPolls]);

  const handleCreatePoll = () => {
    if (!isConnected) {
      openAuthModal();
    } else {
      // Already connected, let them navigate to create-poll page
      window.location.href = '/create-poll';
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <div className="bg-primary-600 text-white">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl">
            Decentralized Polling on Blockchain
          </h1>
          <p className="mt-6 text-xl max-w-3xl">
            Create and vote on polls using blockchain technology.
            Transparent, secure, and tamper-proof.
          </p>
          
          <div className="mt-10">
            <button 
              onClick={handleCreatePoll}
              className="btn btn-primary bg-white text-primary-700"
            >
              Create a Poll
            </button>
          </div>
        </div>
      </div>
      
      {/* Recent Polls Section */}
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold mb-6">Recent Polls</h2>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
            <p className="mt-4">Loading recent polls...</p>
          </div>
        ) : recentPolls.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentPolls.map(poll => (
              <PollCard key={poll._id} poll={poll} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p>No polls available yet. Be the first to create one!</p>
          </div>
        )}
        
        <div className="text-center mt-8">
          <Link to="/polls" className="btn btn-secondary">
            View All Polls
          </Link>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Blockchain-Based</h3>
              <p className="text-gray-600">All polls and votes are stored on the Polygon blockchain, ensuring transparency and immutability.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Proxy Wallets</h3>
              <p className="text-gray-600">Vote easily without paying gas fees using our proxy wallet system.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Real-time Results</h3>
              <p className="text-gray-600">See poll results update in real-time as votes are cast.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Categorization</h3>
              <p className="text-gray-600">Browse polls by categories and tags to find topics that interest you.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;