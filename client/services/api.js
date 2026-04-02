// services/api.js - FIXED
import axios from 'axios';

// In browser (client-side), axios needs the full URL to the gateway
// During development, bypass Next.js and connect directly to the gateway
// NOTE: Gateway routes are under /api prefix, so include that!
const API_BASE_URL = typeof window !== 'undefined' 
  ? 'http://localhost:5000/api' 
  : 'http://localhost:5000/api';

console.log('🔧 API Initialized with BASE_URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log('📤 [API REQUEST]', {
      method: config.method?.toUpperCase(),
      url: config.url,
      fullUrl: fullUrl,
      baseURL: config.baseURL,
      data: config.data ? JSON.stringify(config.data).substring(0, 100) : null,
      timestamp: new Date().toISOString(),
    });
    return config;
  },
  (error) => {
    console.error('❌ [API REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('✅ [API RESPONSE]', {
      status: response.status,
      url: response.config.url,
      dataKeys: response.data ? Object.keys(response.data) : null,
      timestamp: new Date().toISOString(),
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.error('❌ [API ERROR]', {
      status: error.response?.status,
      url: error.config?.url,
      fullUrl: error.config ? `${error.config.baseURL}${error.config.url}` : null,
      message: error.message,
      responseData: error.response?.data,
      timestamp: new Date().toISOString(),
    });
    
    // Handle 401 errors with token refresh - BUT NOT FOR LOGIN/REFRESH ENDPOINTS
    if (error.response?.status === 401 && 
        !originalRequest._retry &&
        !originalRequest.url.includes('/auth/login') &&
        !originalRequest.url.includes('/auth/refresh') &&
        !originalRequest.url.includes('/auth/logout')) {
      
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`, 
          {},
          { 
            withCredentials: true,
            // Don't retry refresh requests indefinitely
            _noRetry: true 
          }
        );
        
        if (refreshResponse.status === 200) {
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Don't infinite loop - clear auth and redirect
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth');
          window.location.href = '/login';
        }
      }
    }
    
    // For logout or other specific endpoints, don't redirect
    if (error.response?.status === 401 && 
        originalRequest.url.includes('/auth/logout')) {
      // Just clear local storage without redirecting
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth');
      }
    }
    
    return Promise.reject(error);
  }
);

export const logoutUser = async () => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Always clear client-side state
    localStorage.removeItem('auth');
    window.location.href = '/login';
  }
};

export default api;