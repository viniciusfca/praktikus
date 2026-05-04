import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { PublicOnlyRoute } from './PublicOnlyRoute';

vi.mock('../store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '../store/auth.store';
const mockUseAuthStore = useAuthStore as any;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnlyRoute>
              <div>Landing</div>
            </PublicOnlyRoute>
          }
        />
        <Route path="/workshop/dashboard" element={<div>Workshop Dashboard</div>} />
        <Route path="/recycling/dashboard" element={<div>Recycling Dashboard</div>} />
        <Route path="/suspended" element={<div>Suspended Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicOnlyRoute', () => {
  it('renders children when not authenticated', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ isAuthenticated: false, isHydrated: true, user: null }),
    );
    renderAt('/');
    expect(screen.getByText('Landing')).toBeInTheDocument();
  });

  it('redirects WORKSHOP authenticated user to /workshop/dashboard', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        isAuthenticated: true,
        isHydrated: true,
        user: { tenant_status: 'ACTIVE', tenant_segment: 'WORKSHOP' },
      }),
    );
    renderAt('/');
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
    expect(screen.getByText('Workshop Dashboard')).toBeInTheDocument();
  });

  it('redirects RECYCLING authenticated user to /recycling/dashboard', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        isAuthenticated: true,
        isHydrated: true,
        user: { tenant_status: 'ACTIVE', tenant_segment: 'RECYCLING' },
      }),
    );
    renderAt('/');
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
    expect(screen.getByText('Recycling Dashboard')).toBeInTheDocument();
  });

  it('redirects SUSPENDED user to /suspended (regardless of segment)', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        isAuthenticated: true,
        isHydrated: true,
        user: { tenant_status: 'SUSPENDED', tenant_segment: 'WORKSHOP' },
      }),
    );
    renderAt('/');
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
    expect(screen.getByText('Suspended Page')).toBeInTheDocument();
  });

  it('renders nothing while not yet hydrated', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ isAuthenticated: false, isHydrated: false, user: null }),
    );
    const { container } = renderAt('/');
    expect(container.firstChild).toBeNull();
  });
});
