import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({ get: vi.fn(), post: vi.fn() })),
  },
}));

import { serviceOrdersApi, soItemsServicesApi, soItemsPartsApi } from './service-orders.service';
import { api } from './api';

const mockApi = api as any;

describe('serviceOrdersApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/service-orders on list', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await serviceOrdersApi.list();
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/service-orders', expect.any(Object));
  });

  it('should call POST /workshop/service-orders on create', async () => {
    const payload = { clienteId: 'c1', veiculoId: 'v1' };
    mockApi.post.mockResolvedValue({ data: { id: 'so1', ...payload } });
    const result = await serviceOrdersApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/service-orders', payload);
    expect(result.id).toBe('so1');
  });

  it('should call PATCH /workshop/service-orders/:id/status on patchStatus', async () => {
    mockApi.patch.mockResolvedValue({ data: { id: 'so1', status: 'APROVADO' } });
    const result = await serviceOrdersApi.patchStatus('so1', 'APROVADO');
    expect(mockApi.patch).toHaveBeenCalledWith('/workshop/service-orders/so1/status', { status: 'APROVADO' });
    expect(result.status).toBe('APROVADO');
  });

  it('should call DELETE /workshop/service-orders/:id on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await serviceOrdersApi.delete('so1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/service-orders/so1');
  });
});

describe('soItemsServicesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call POST .../items/services on create', async () => {
    const item = { id: 'i1', nomeServico: 'Troca de óleo' };
    mockApi.post.mockResolvedValue({ data: item });
    const result = await soItemsServicesApi.create('so1', {
      catalogServiceId: 'cs1',
      nomeServico: 'Troca de óleo',
      valor: 100,
    });
    expect(mockApi.post).toHaveBeenCalledWith(
      '/workshop/service-orders/so1/items/services',
      expect.any(Object),
    );
    expect(result.id).toBe('i1');
  });
});

describe('soItemsPartsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call DELETE .../items/parts/:itemId on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await soItemsPartsApi.delete('so1', 'p1');
    expect(mockApi.delete).toHaveBeenCalledWith(
      '/workshop/service-orders/so1/items/parts/p1',
    );
  });
});
