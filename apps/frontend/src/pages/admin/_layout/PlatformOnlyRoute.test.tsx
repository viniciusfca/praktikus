import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlatformOnlyRoute } from './PlatformOnlyRoute';

vi.mock('../../../store/platform-auth.store', () => ({
  usePlatformAuthStore: vi.fn(),
}));

import { usePlatformAuthStore } from '../../../store/platform-auth.store';
const mockStore = usePlatformAuthStore as any;

describe('PlatformOnlyRoute', () => {
  it('renderiza filhos quando autenticado', () => {
    mockStore.mockImplementation((s: any) =>
      s({ isAuthenticated: true, isHydrated: true }),
    );
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <PlatformOnlyRoute>
                <div>OK</div>
              </PlatformOnlyRoute>
            }
          />
          <Route path="/admin/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('redireciona pra /admin/login quando não autenticado', () => {
    mockStore.mockImplementation((s: any) =>
      s({ isAuthenticated: false, isHydrated: true }),
    );
    render(
      <MemoryRouter initialEntries={['/admin/clientes']}>
        <Routes>
          <Route
            path="/admin/clientes"
            element={
              <PlatformOnlyRoute>
                <div>OK</div>
              </PlatformOnlyRoute>
            }
          />
          <Route path="/admin/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('OK')).not.toBeInTheDocument();
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('persiste pk_admin_page quando redireciona', () => {
    localStorage.clear();
    mockStore.mockImplementation((s: any) =>
      s({ isAuthenticated: false, isHydrated: true }),
    );
    render(
      <MemoryRouter initialEntries={['/admin/clientes']}>
        <Routes>
          <Route
            path="/admin/clientes"
            element={
              <PlatformOnlyRoute>
                <div>OK</div>
              </PlatformOnlyRoute>
            }
          />
          <Route path="/admin/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(localStorage.getItem('pk_admin_page')).toBe('/admin/clientes');
  });
});
