import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePlatformAuthStore } from '../../../store/platform-auth.store';

interface Props {
  children: ReactNode;
}

export function PlatformOnlyRoute({ children }: Props) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);
  const isHydrated = usePlatformAuthStore((s) => s.isHydrated);
  const location = useLocation();

  if (!isHydrated) return null;
  if (!isAuthenticated) {
    // Persiste última página tentada (sem o /admin/login final)
    if (
      location.pathname !== '/admin/login' &&
      location.pathname.startsWith('/admin')
    ) {
      localStorage.setItem('pk_admin_page', location.pathname);
    }
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
