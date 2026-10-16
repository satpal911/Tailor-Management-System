import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const readCsrfCookie = () => {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('csrf_token='))
    ?.slice('csrf_token='.length);
  return value ? decodeURIComponent(value) : null;
};

const fetchCsrfToken = async () => {
  const response = await api.get('/auth/csrf');
  return response.data?.data?.csrfToken || readCsrfCookie();
};

api.interceptors.request.use(async (config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    const token = readCsrfCookie() || (await fetchCsrfToken());
    if (token) config.headers.set('X-CSRF-Token', token);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const isCsrfFailure =
      error.response?.status === 403 &&
      /csrf token is missing or invalid/i.test(error.response?.data?.message || '');
    if (!config || !isCsrfFailure || config.__csrfRetried) throw error;

    config.__csrfRetried = true;
    const token = await fetchCsrfToken();
    if (!token) throw error;
    config.headers.set('X-CSRF-Token', token);
    return api.request(config);
  },
);

export const unwrap = (response) => response.data?.data;
export default api;
