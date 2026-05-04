import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminAuthService } from './admin-auth.service';

vi.mock('./admin.api', () => ({
  adminApi: { post: vi.fn() },
  ADMIN_TOKEN_KEYS: {
    access: 'pk_admin_access_token',
    refresh: 'pk_admin_refresh_token',
  },
}));

import { adminApi } from './admin.api';
const mockPost = (adminApi as any).post as ReturnType<typeof vi.fn>;

describe('adminAuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPost.mockReset();
  });

  it('login chama POST /admin/auth/login e devolve tokens', async () => {
    mockPost.mockResolvedValue({
      data: {
        access_token: 'a',
        refresh_token: 'r',
        user: { id: 'u', email: 'e@e', name: 'n' },
      },
    });
    const out = await adminAuthService.login({ email: 'e@e', password: 'p' });
    expect(mockPost).toHaveBeenCalledWith('/admin/auth/login', {
      email: 'e@e',
      password: 'p',
    });
    expect(out.access_token).toBe('a');
  });

  it('persistTokens grava nas chaves pk_admin_*', () => {
    adminAuthService.persistTokens({
      access_token: 'a',
      refresh_token: 'r',
      user: { id: 'u', email: 'e@e', name: 'n' },
    });
    expect(localStorage.getItem('pk_admin_access_token')).toBe('a');
    expect(localStorage.getItem('pk_admin_refresh_token')).toBe('r');
  });

  it('clearTokens remove ambas as chaves', () => {
    localStorage.setItem('pk_admin_access_token', 'a');
    localStorage.setItem('pk_admin_refresh_token', 'r');
    adminAuthService.clearTokens();
    expect(localStorage.getItem('pk_admin_access_token')).toBeNull();
    expect(localStorage.getItem('pk_admin_refresh_token')).toBeNull();
  });
});
