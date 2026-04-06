import axios from 'axios';

const getContextHeaders = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const headers = {};
  const activeOrgId = window.localStorage.getItem('activeOrgId');
  const activeProjectId = window.localStorage.getItem('activeProjectId');

  if (activeOrgId) {
    headers['x-org-id'] = activeOrgId;
  }

  if (activeProjectId) {
    headers['x-project-id'] = activeProjectId;
  }

  return headers;
};

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  Object.assign(config.headers, getContextHeaders());
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/')
    ) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;