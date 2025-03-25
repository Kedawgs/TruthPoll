// src/pages/Login.js (if you don't already have one)
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Web3Context } from '../context/Web3Context';

const Login = () => {
  const navigate = useNavigate();
  const { loginWithMagic, connectWallet, loading, error } = useContext(Web3Context);
  const [email, setEmail] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const success = await loginWithMagic('email', { email });
    if (success) navigate('/');
  };

  const handleWalletConnect = async () => {
    const success = await connectWallet();
    if (success) navigate('/');
  };

  return (
    <div className="max-w-md mx-auto my-10 p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p>{error}</p>
        </div>
      )}
      
      <form onSubmit={handleEmailSubmit} className="mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700"
        >
          {loading ? 'Logging in...' : 'Login with Email'}
        </button>
      </form>
      
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">OR</span>
        </div>
      </div>
      
      <button
        onClick={handleWalletConnect}
        disabled={loading}
        className="w-full mb-4 flex items-center justify-center border border-gray-300 rounded-md py-2 px-4"
      >
        Connect Wallet
      </button>
    </div>
  );
};

export default Login;