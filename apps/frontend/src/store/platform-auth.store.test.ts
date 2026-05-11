import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlatformAuthStore } from './platform-auth.store';

vi.mock('../services/admin-auth.service', () => ({
  adminAuthService: {
    persistTokens: vi.fn(),
    clearTokens: vi.fn(),
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

import { adminAuthService } from '../services/admin-auth.service';
import { jwtDecode } from 'jwt-decode';

describe('usePlatformAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlatformAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
    });
  });

  it('hydrate marca authenticated quando token de plataforma é válido', () => {
    (adminAuthService.getAccessToken as any).mockReturnValue('valid.jwt');
    (jwtDecode as any).mockReturnValue({
      sub: 'u1',
      email: 'a@a',
      name: 'A',
      is_platform_user: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    usePlatformAuthStore.getState().hydrate();
    const state = usePlatformAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isHydrated).toBe(true);
    expect(state.user?.email).toBe('a@a');
  });

  it('hydrate limpa tokens se is_platform_user faltar', () => {
    (adminAuthService.getAccessToken as any).mockReturnValue('jwt');
    (jwtDecode as any).mockReturnValue({
      sub: 'u1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    usePlatformAuthStore.getState().hydrate();
    expect(adminAuthService.clearTokens).toHaveBeenCalled();
    expect(usePlatformAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('hydrate limpa tokens se expirado', () => {
    (adminAuthService.getAccessToken as any).mockReturnValue('jwt');
    (jwtDecode as any).mockReturnValue({
      sub: 'u1',
      is_platform_user: true,
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    usePlatformAuthStore.getState().hydrate();
    expect(adminAuthService.clearTokens).toHaveBeenCalled();
  });

  it('setTokens persiste e decodifica', () => {
    (jwtDecode as any).mockReturnValue({
      sub: 'u1',
      email: 'a@a',
      name: 'A',
      is_platform_user: true,
      exp: 0,
    });
    usePlatformAuthStore.getState().setTokens({
      access_token: 'a',
      refresh_token: 'r',
      user: { id: 'u1', email: 'a@a', name: 'A' },
    });
    expect(adminAuthService.persistTokens).toHaveBeenCalled();
    expect(usePlatformAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('logout chama service e zera state', async () => {
    (adminAuthService.getRefreshToken as any).mockReturnValue('r');
    await usePlatformAuthStore.getState().logout();
    expect(adminAuthService.logout).toHaveBeenCalledWith('r');
    expect(adminAuthService.clearTokens).toHaveBeenCalled();
    expect(usePlatformAuthStore.getState().user).toBeNull();
  });
});
