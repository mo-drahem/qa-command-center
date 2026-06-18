import axios from 'axios';
import { getStoredApiKey } from './runtimeConfig';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 180000,
});

client.interceptors.request.use((config) => {
  const apiKey = getStoredApiKey();
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

export default client;
