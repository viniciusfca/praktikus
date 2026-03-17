import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { vehiclesService } from './vehicles.service';
import { api } from './api';
const mockApi = api as any;

describe('vehiclesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/vehicles on list', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } });
    const result = await vehiclesService.list({ page: 1 });
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/vehicles', expect.any(Object));
    expect(result.data).toEqual([]);
  });

  it('should call POST /workshop/vehicles on create', async () => {
    const payload = { customerId: 'c1', placa: 'ABC1234', marca: 'Ford', modelo: 'Ka', ano: 2020, km: 0 };
    mockApi.post.mockResolvedValue({ data: { id: 'v1', ...payload } });
    const result = await vehiclesService.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/vehicles', payload);
    expect(result.id).toBe('v1');
  });
});
