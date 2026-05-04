import { adminApi, ADMIN_TOKEN_KEYS } from './admin.api';

export interface AdminLoginPayload {
  email: string;
  password: string;
}

export interface AdminAuthTokens {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; name: string };
}

export const adminAuthService = {
  async login(payload: AdminLoginPayload): Promise<AdminAuthTokens> {
    const { data } = await adminApi.post<AdminAuthTokens>(
      '/admin/auth/login',
      payload,
    );
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await adminApi.post('/admin/auth/logout', { refresh_token: refreshToken });
  },

  persistTokens(tokens: AdminAuthTokens): void {
    localStorage.setItem(ADMIN_TOKEN_KEYS.access, tokens.access_token);
    localStorage.setItem(ADMIN_TOKEN_KEYS.refresh, tokens.refresh_token);
  },

  clearTokens(): void {
    localStorage.removeItem(ADMIN_TOKEN_KEYS.access);
    localStorage.removeItem(ADMIN_TOKEN_KEYS.refresh);
  },

  getAccessToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEYS.access);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEYS.refresh);
  },
};
