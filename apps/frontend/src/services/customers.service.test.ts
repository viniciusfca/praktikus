import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { customersService } from './customers.service';
import { api } from './api';
const mockApi = api as any;

describe('customersService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/customers on list', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } });
    const result = await customersService.list({ page: 1, limit: 20 });
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/customers', expect.any(Object));
    expect(result.data).toEqual([]);
  });

  it('should call POST /workshop/customers on create', async () => {
    const payload = { nome: 'João', cpfCnpj: '12345678901' };
    mockApi.post.mockResolvedValue({ data: { id: 'c1', ...payload } });
    const result = await customersService.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/customers', payload);
    expect(result.id).toBe('c1');
  });

  it('should call DELETE /workshop/customers/:id on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await customersService.delete('c1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/customers/c1');
  });
});
