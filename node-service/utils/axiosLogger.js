// node-service/utils/axiosLogger.js
const axios = require('axios');
const logger = require('./logger');

// Create a custom axios instance
const axiosInstance = axios.create({
  // baseURL can be set if you mostly call the same host
  // e.g. baseURL: 'https://api.github.com'
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    logger.info(
      `Outgoing request: ${config.method.toUpperCase()} ${config.url}`,
      {
        params: config.params,
        data: config.data,
      }
    );
    return config;
  },
  (error) => {
    logger.error('Request error', { error });
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    logger.info(`Response: ${response.status} ${response.config.url}`, {
      data: response.data?.length ? `Length: ${response.data.length}` : '',
    });
    return response;
  },
  (error) => {
    logger.error(
      `Response error: ${error.response?.status} on ${error.config?.url}`,
      {
        error: error.message,
        data: error.response?.data,
      }
    );
    return Promise.reject(error);
  }
);

module.exports = axiosInstance;
