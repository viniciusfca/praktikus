import { api } from './api';

export interface RegisterPayload {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  password: string;
  ownerName: string;
  telefone?: string;
  segment?: 'WORKSHOP' | 'RECYCLING';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<AuthTokens> {
    const { data } = await api.post<AuthTokens>('/auth/register', payload);
    return data;
  },

  async login(payload: LoginPayload): Promise<AuthTokens> {
    const { data } = await api.post<AuthTokens>('/auth/login', payload);
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refresh_token: refreshToken });
  },

  persistTokens(tokens: AuthTokens): void {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
  },

  clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.patch('/auth/me/password', { currentPassword, newPassword });
  },
};
