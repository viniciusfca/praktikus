import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface Props {
  children: ReactNode;
}

export function PublicOnlyRoute({ children }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const user = useAuthStore((s) => s.user);

  if (!isHydrated) return null;
  if (!isAuthenticated) return <>{children}</>;

  if (user?.tenant_status === 'SUSPENDED') {
    return <Navigate to="/suspended" replace />;
  }

  const redirectTo =
    user?.tenant_segment === 'RECYCLING'
      ? '/recycling/dashboard'
      : '/workshop/dashboard';
  return <Navigate to={redirectTo} replace />;
}
