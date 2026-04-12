import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // adjust if backend is running on different port/url
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

export default api;
