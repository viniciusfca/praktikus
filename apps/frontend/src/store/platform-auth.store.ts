import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { adminAuthService } from '../services/admin-auth.service';

export interface PlatformJwtUser {
  sub: string;
  email: string;
  name: string;
  is_platform_user: true;
  exp: number;
}

interface PlatformAuthState {
  user: PlatformJwtUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setTokens: (t: {
    access_token: string;
    refresh_token: string;
    user: { id: string; email: string; name: string };
  }) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
}

export const usePlatformAuthStore = create<PlatformAuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,

  setTokens(tokens) {
    adminAuthService.persistTokens(tokens);
    const decoded = jwtDecode<PlatformJwtUser>(tokens.access_token);
    set({ user: decoded, isAuthenticated: true, isHydrated: true });
  },

  async logout() {
    const refresh = adminAuthService.getRefreshToken();
    if (refresh) {
      try {
        await adminAuthService.logout(refresh);
      } catch {
        // silent — token may already be invalid
      }
    }
    adminAuthService.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  hydrate() {
    const token = adminAuthService.getAccessToken();
    if (token) {
      try {
        const decoded = jwtDecode<PlatformJwtUser>(token);
        const expired = decoded.exp * 1000 < Date.now();
        if (!expired && decoded.is_platform_user === true) {
          set({ user: decoded, isAuthenticated: true, isHydrated: true });
          return;
        }
        adminAuthService.clearTokens();
      } catch {
        adminAuthService.clearTokens();
      }
    }
    set({ isHydrated: true });
  },
}));
