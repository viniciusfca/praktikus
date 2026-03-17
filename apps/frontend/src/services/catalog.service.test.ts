import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { catalogServicesApi, catalogPartsApi } from './catalog.service';
import { api } from './api';
const mockApi = api as any;

describe('catalogServicesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/catalog/services on list', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } });
    const result = await catalogServicesApi.list({ page: 1, limit: 20 });
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/catalog/services', expect.any(Object));
    expect(result.data).toEqual([]);
  });

  it('should call POST /workshop/catalog/services on create', async () => {
    const payload = { nome: 'Troca de óleo', precoPadrao: 80 };
    mockApi.post.mockResolvedValue({ data: { id: 's1', ...payload } });
    const result = await catalogServicesApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/catalog/services', payload);
    expect(result.id).toBe('s1');
  });

  it('should call DELETE /workshop/catalog/services/:id on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await catalogServicesApi.delete('s1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/catalog/services/s1');
  });
});

describe('catalogPartsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/catalog/parts on list', async () => {
    mockApi.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } });
    const result = await catalogPartsApi.list({ page: 1, limit: 20 });
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/catalog/parts', expect.any(Object));
    expect(result.data).toEqual([]);
  });

  it('should call POST /workshop/catalog/parts on create', async () => {
    const payload = { nome: 'Filtro de óleo', precoUnitario: 25 };
    mockApi.post.mockResolvedValue({ data: { id: 'p1', ...payload } });
    const result = await catalogPartsApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/catalog/parts', payload);
    expect(result.id).toBe('p1');
  });

  it('should call DELETE /workshop/catalog/parts/:id on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await catalogPartsApi.delete('p1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/catalog/parts/p1');
  });
});
