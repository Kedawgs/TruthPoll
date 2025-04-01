// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { useAppContext } from './hooks/useAppContext';
import SubNav from './components/SubNav';
import Navbar from './components/Navbar'; 
import Home from './pages/Home';
import PollsList from './pages/PollsList';
import PollDetail from './pages/PollDetail';
import CreatePoll from './pages/CreatePoll';
import Leaderboard from './pages/Leaderboard';
import Activity from './pages/Activity';
import MagicRedirect from './components/MagicRedirect'; 
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';
import AuthModal from './components/AuthModal';
import UsernameModal from './components/UsernameModal';
import AdminDashboard from './pages/AdminDashboard';
import AdminConfig from './pages/AdminConfig';

function App() {
  const [appSupport, setAppSupport] = useState({
    localStorage: true,
    web3: true
  });
  const [appLoading, setAppLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    const hasLocalStorage = (() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch (e) {
        return false;
      }
    })();
    
    const hasWeb3 = typeof window !== 'undefined' && 
                    (typeof window.ethereum !== 'undefined' || 
                     typeof window.web3 !== 'undefined');
    
    setAppSupport({
      localStorage: hasLocalStorage,
      web3: hasWeb3
    });
    
    setIsInitialized(true);
    setAppLoading(false);
  }, []);

  if (appLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!appSupport.localStorage || !appSupport.web3) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-center">Browser Compatibility Issue</h2>
          <div className="space-y-4">
            {!appSupport.localStorage && (
              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
                <p>Your browser doesn't support local storage, which is required for this application.</p>
              </div>
            )}
            {!appSupport.web3 && (
              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
                <p>Your browser doesn't have Web3 capabilities, which are required for blockchain interactions.</p>
              </div>
            )}
            <p className="text-center mt-4">
              Please try using a modern browser like Chrome, Firefox, or Brave.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppProvider>
      <Router>
        <AppContent />
      </Router>
    </AppProvider>
  );
}

function AppContent() {
  const { 
    isConnected, 
    account,
    isAdmin,
    logout, 
    needsUsername,
    openAuthModal 
  } = useAppContext();

  const [activeFilter, setActiveFilter] = useState('all');

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    console.log('Filter changed to:', filter);
  };

  const ProtectedRoute = ({ children }) => {
    if (!isConnected) {
      openAuthModal();
      return <Navigate to="/" />;
    }
    return children;
  };

  const AdminRoute = ({ children }) => {
    if (!isAdmin) {
      return <Navigate to="/" />;
    }
    return children;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <SubNav 
        onTabChange={handleFilterChange} 
        nonClickableItems={['live']} 
      />
      
      <main className="container mx-auto px-4 py-8 flex-grow" style={{ marginTop: '114px' }}> {/* 56px navbar + 58px subnav */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/polls" element={<PollsList />} />
          <Route path="/polls/:filter" element={<PollsList />} />
          <Route path="/polls/id/:id" element={<PollDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/activity" element={<Activity />} />
          <Route 
            path="/create-poll" 
            element={
              <ProtectedRoute>
                <CreatePoll />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/config" 
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminConfig />
                </AdminRoute>
              </ProtectedRoute>
            } 
          />
          
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/magic-callback" element={<MagicRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      
      <footer className="bg-white border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} TruthPoll. All rights reserved.</p>
          <div className="mt-2 flex justify-center space-x-4">
            <a href="/privacy" className="hover:text-gray-700">Privacy Policy</a>
            <a href="/terms" className="hover:text-gray-700">Terms of Service</a>
          </div>
          <p className="mt-2">Running on Polygon Amoy Testnet</p>
        </div>
      </footer>
      
      <AuthModal />
      
      {isConnected && needsUsername && <UsernameModal />}
    </div>
  );
}

export default App;