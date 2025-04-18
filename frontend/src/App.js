// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
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
import Profile from './pages/Profile';
import Footer from './components/Footer';

// --- Helper Wrapper Component for PollDetail ---
// This component gets the 'id' and passes it as a 'key' to PollDetail
function PollDetailWrapper() {
  const { id } = useParams();
  // When the 'id' changes, the key changes, forcing PollDetail to remount
  return <PollDetail key={id} />;
}
// --- End Helper Wrapper ---

function App() {
  const [appSupport, setAppSupport] = useState({
    localStorage: true
  });
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    // Check for localStorage support
    const hasLocalStorage = (() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch (e) {
        return false;
      }
    })();

    setAppSupport({
      localStorage: hasLocalStorage
    });

    setAppLoading(false);
  }, []);

  if (appLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!appSupport.localStorage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-center">Browser Compatibility Issue</h2>
          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
            <p>Your browser doesn't support local storage, which is required for this application to function properly.</p>
          </div>
          <p className="text-center mt-4">
            Please try using a modern browser like Chrome, Firefox, or Brave. You can also try disabling private browsing mode.
          </p>
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
    isAdmin,
    needsUsername,
    openAuthModal
  } = useAppContext();

  const handleFilterChange = (filter) => {
    // Handle tab changes in SubNav
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

          {/* === UPDATED PollDetail Route === */}
          <Route
            path="/polls/id/:id"
            element={<PollDetailWrapper />} // Use the wrapper component
          />
          {/* === END UPDATED Route === */}

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
          
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/magic-callback" element={<MagicRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />

      <AuthModal />

      {isConnected && needsUsername && <UsernameModal />}
    </div>
  );
}

export default App;