import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { PrivateRoute } from './PrivateRoute';

vi.mock('../store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '../store/auth.store';
const mockUseAuthStore = useAuthStore as any;

describe('PrivateRoute', () => {
  it('renders children when authenticated', () => {
    mockUseAuthStore.mockImplementation((selector: any) => selector({ isAuthenticated: true, isHydrated: true }));
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<PrivateRoute><div>Protected Content</div></PrivateRoute>} />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    mockUseAuthStore.mockImplementation((selector: any) => selector({ isAuthenticated: false, isHydrated: true }));
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<PrivateRoute><div>Protected Content</div></PrivateRoute>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
