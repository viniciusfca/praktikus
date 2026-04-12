import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface Props {
  children: ReactNode;
  requiredSegment?: 'WORKSHOP' | 'RECYCLING';
}

export function PrivateRoute({ children, requiredSegment }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const user = useAuthStore((s) => s.user);

  if (!isHydrated) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (requiredSegment && user?.tenant_segment !== requiredSegment) {
    const redirectTo =
      user?.tenant_segment === 'RECYCLING' ? '/recycling/dashboard' : '/workshop/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
