import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { authService } from './auth.service';
import { api } from './api';

const mockApi = api as any;

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should persist tokens to localStorage', () => {
    authService.persistTokens({ access_token: 'acc', refresh_token: 'ref' });
    expect(localStorage.getItem('access_token')).toBe('acc');
    expect(localStorage.getItem('refresh_token')).toBe('ref');
  });

  it('should clear tokens from localStorage', () => {
    localStorage.setItem('access_token', 'tok');
    authService.clearTokens();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('should return true for isAuthenticated when token exists', () => {
    localStorage.setItem('access_token', 'tok');
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('should return false for isAuthenticated when no token', () => {
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('should call api.post on login and return tokens', async () => {
    mockApi.post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r' } });
    const result = await authService.login({ email: 'a@b.com', password: 'pass1234' });
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'pass1234' });
    expect(result.access_token).toBe('a');
  });

  it('should call api.post on register and return tokens', async () => {
    mockApi.post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r' } });
    const result = await authService.register({
      cnpj: '12345678000199',
      razaoSocial: 'Test',
      nomeFantasia: 'Test',
      email: 'a@b.com',
      password: 'pass1234',
      ownerName: 'Test',
    });
    expect(result.access_token).toBe('a');
  });
});
