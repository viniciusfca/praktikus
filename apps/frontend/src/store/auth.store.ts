import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { authService } from '../services/auth.service';

interface JwtUser {
  sub: string;
  tenant_id: string;
  role: 'OWNER' | 'EMPLOYEE';
  exp?: number;
}

interface AuthState {
  user: JwtUser | null;
  isAuthenticated: boolean;
  setTokens: (tokens: { access_token: string; refresh_token: string }) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setTokens(tokens) {
    authService.persistTokens(tokens);
    const decoded = jwtDecode<JwtUser>(tokens.access_token);
    set({ user: decoded, isAuthenticated: true });
  },

  async logout() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        // silently ignore — token may already be invalid
      }
    }
    authService.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  hydrate() {
    const token = authService.getAccessToken();
    if (!token) return;
    try {
      const decoded = jwtDecode<JwtUser>(token);
      const isExpired = decoded.exp ? decoded.exp * 1000 < Date.now() : false;
      if (!isExpired) {
        set({ user: decoded, isAuthenticated: true });
      } else {
        authService.clearTokens();
      }
    } catch {
      authService.clearTokens();
    }
  },
}));
