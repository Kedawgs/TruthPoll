import axios from 'axios';
import createMagicInstance from '../config/magic';

// Create an axios instance with the correct base URL
const api = axios.create({
  baseURL: 'http://localhost:5000/api'
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

export default api;