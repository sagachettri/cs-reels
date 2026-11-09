import axios from 'axios';

// In development, Vite proxies /api to the backend.
// In production, a Vercel rewrite does the same, so cookies stay same-origin.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
});

export default api;
