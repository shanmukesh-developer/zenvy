import axios from 'axios';

const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005'}/api`,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('restaurantToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If server is waking up (timeout/network error), retry once after 5s
    if (!error.response && !originalRequest._retried) {
      originalRequest._retried = true;
      console.warn('[API] Server may be waking up, retrying in 5s...');
      await new Promise(r => setTimeout(r, 5000));
      return api(originalRequest);
    }

    if (error.response?.status === 401) {
      console.warn('Authentication failure detected. Clearing session...');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('restaurantToken');
        localStorage.removeItem('restaurantUser');
        window.location.href = '/login/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
