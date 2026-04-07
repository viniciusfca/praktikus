import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { authService } from '../services/auth.service';

// Fields decoded from the access token via jwtDecode (no signature verification).
// name and email are DISPLAY-ONLY — treat as untrusted strings; never use for
// server-side identity or access decisions.
export interface JwtUser {
  sub: string;
  tenant_id: string;
  role: 'OWNER' | 'EMPLOYEE';
  name: string;
  email: string;
  exp: number;
  tenant_status: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';
}

interface AuthState {
  user: JwtUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setTokens: (tokens: { access_token: string; refresh_token: string }) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,

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
    if (token) {
      try {
        const decoded = jwtDecode<JwtUser>(token);
        const isExpired = decoded.exp * 1000 < Date.now();
        if (!isExpired) {
          set({ user: decoded, isAuthenticated: true, isHydrated: true });
          return;
        } else {
          authService.clearTokens();
        }
      } catch {
        authService.clearTokens();
      }
    }
    set({ isHydrated: true });
  },
}));
