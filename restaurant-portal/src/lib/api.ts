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
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Authentication failure detected by Nexus. Clearing session...');
      if (typeof window !== 'undefined') {
        localStorage.clear();
        window.location.href = '/login/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
