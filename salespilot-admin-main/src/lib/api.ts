import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

let currentToken: string | null = null;

export const setToken = (token: string | null) => {
  currentToken = token;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (currentToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      currentToken = null;
      // Redirect to login unless we're already there
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);
