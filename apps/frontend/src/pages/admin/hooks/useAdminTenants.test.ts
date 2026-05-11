import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminTenants } from './useAdminTenants';

vi.mock('../../../services/admin.api', () => ({
  adminApi: { get: vi.fn() },
}));

import { adminApi } from '../../../services/admin.api';
const mockGet = (adminApi as any).get as ReturnType<typeof vi.fn>;

describe('useAdminTenants', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({
      data: {
        data: [],
        total: 0,
        page: 1,
        pageSize: 25,
        countersByStatus: { ACTIVE: 0, TRIAL: 0, OVERDUE: 0, SUSPENDED: 0 },
      },
    });
  });

  it('aplica status, segment, wpp como params', async () => {
    renderHook(() =>
      useAdminTenants({
        status: 'ACTIVE',
        segment: 'WORKSHOP',
        wpp: 'yes',
        page: 1,
        pageSize: 25,
      }),
    );
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const call = mockGet.mock.calls[0];
    expect(call[0]).toBe('/admin/tenants');
    expect(call[1].params.status).toBe('ACTIVE');
    expect(call[1].params.segment).toBe('WORKSHOP');
    expect(call[1].params.wpp).toBe('yes');
  });

  it('omite filtros quando "all"', async () => {
    renderHook(() =>
      useAdminTenants({
        status: 'all',
        segment: 'all',
        wpp: 'all',
      }),
    );
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const params = mockGet.mock.calls[0][1].params;
    expect(params.status).toBeUndefined();
    expect(params.segment).toBeUndefined();
    expect(params.wpp).toBeUndefined();
  });
});
