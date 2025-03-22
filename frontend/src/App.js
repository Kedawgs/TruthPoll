import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Web3Provider } from './context/Web3Context';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PollsList from './pages/PollsList';
import PollDetail from './pages/PollDetail';
import CreatePoll from './pages/CreatePoll';
import SignUp from './pages/SignUp';
import MagicRedirect from './components/MagicRedirect'; // Import the new component
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Web3Provider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/polls" element={<PollsList />} />
              <Route path="/polls/:id" element={<PollDetail />} />
              <Route path="/create-poll" element={<CreatePoll />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/magic-callback" element={<MagicRedirect />} /> {/* Add this route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="bg-white border-t py-6">
            <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
              <p>© {new Date().getFullYear()} TruthPoll. All rights reserved.</p>
              <p className="mt-2">Running on Polygon Amoy Testnet</p>
            </div>
          </footer>
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App;