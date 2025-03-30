// src/utils/api.js
import axios from 'axios';
import createMagicInstance from '../config/magic';

// Create an axios instance with the correct base URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
});

// Add a request interceptor to include auth token
api.interceptors.request.use(async (config) => {
  try {
    // Get Magic instance
    const magic = createMagicInstance();
    
    if (magic) {
      const isLoggedIn = await magic.user.isLoggedIn();
      
      if (isLoggedIn) {
        try {
          // Get DID token
          const token = await magic.user.getIdToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (tokenError) {
          console.error('Error getting auth token:', tokenError);
        }
      }
    }
  } catch (error) {
    console.error('Error in auth interceptor:', error);
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add a response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Add global error handling here if needed
    if (error.response) {
      // Server responded with a status code outside of 2xx range
      console.error('API Error:', error.response.status, error.response.data);
      
      // Handle authentication errors
      if (error.response.status === 401) {
        // Could dispatch an action to logout the user if needed
        console.error('Authentication error');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network error - no response received:', error.request);
    } else {
      // Something happened in setting up the request
      console.error('Request error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;