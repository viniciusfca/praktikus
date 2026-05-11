import axios, { type AxiosError } from 'axios';

const ACCESS_KEY = 'pk_admin_access_token';
const REFRESH_KEY = 'pk_admin_refresh_token';

export const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  },
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original: any = error.config;
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (refreshToken) {
        try {
          const { data } = await axios.post<{
            access_token: string;
            refresh_token: string;
          }>(
            `${import.meta.env.VITE_API_URL ?? '/api'}/admin/auth/refresh`,
            { refresh_token: refreshToken },
          );
          localStorage.setItem(ACCESS_KEY, data.access_token);
          localStorage.setItem(REFRESH_KEY, data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return adminApi(original);
        } catch {
          localStorage.removeItem(ACCESS_KEY);
          localStorage.removeItem(REFRESH_KEY);
          window.location.href = '/admin/login';
        }
      } else {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  },
);

export const ADMIN_TOKEN_KEYS = {
  access: ACCESS_KEY,
  refresh: REFRESH_KEY,
} as const;
