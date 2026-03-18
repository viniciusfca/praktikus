import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { appointmentsApi, appointmentCommentsApi } from './appointments.service';
import { api } from './api';
const mockApi = api as any;

describe('appointmentsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/appointments on list', async () => {
    const items = [{ id: 'a1', status: 'PENDENTE' }];
    mockApi.get.mockResolvedValue({ data: items });
    const result = await appointmentsApi.list();
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/appointments', expect.any(Object));
    expect(result).toEqual(items);
  });

  it('should call POST /workshop/appointments on create', async () => {
    const payload = {
      clienteId: '00000000-0000-0000-0000-000000000002',
      veiculoId: '00000000-0000-0000-0000-000000000003',
      dataHora: '2026-03-17T09:00:00Z',
    };
    const response = { data: { id: 'a1', ...payload }, conflicts: [] };
    mockApi.post.mockResolvedValue({ data: response });
    const result = await appointmentsApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/workshop/appointments', payload);
    expect(result.data.id).toBe('a1');
    expect(result.conflicts).toEqual([]);
  });

  it('should call DELETE /workshop/appointments/:id on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await appointmentsApi.delete('a1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/appointments/a1');
  });
});

describe('appointmentCommentsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call GET /workshop/appointments/:id/comments on list', async () => {
    const comments = [{ id: 'c1', texto: 'Ligou' }];
    mockApi.get.mockResolvedValue({ data: comments });
    const result = await appointmentCommentsApi.list('a1');
    expect(mockApi.get).toHaveBeenCalledWith('/workshop/appointments/a1/comments');
    expect(result).toEqual(comments);
  });

  it('should call POST /workshop/appointments/:id/comments on create', async () => {
    const comment = { id: 'c1', texto: 'Ligou, não atendeu' };
    mockApi.post.mockResolvedValue({ data: comment });
    const result = await appointmentCommentsApi.create('a1', 'Ligou, não atendeu');
    expect(mockApi.post).toHaveBeenCalledWith(
      '/workshop/appointments/a1/comments',
      { texto: 'Ligou, não atendeu' },
    );
    expect(result.id).toBe('c1');
  });

  it('should call DELETE /workshop/appointments/:id/comments/:commentId on delete', async () => {
    mockApi.delete.mockResolvedValue({});
    await appointmentCommentsApi.delete('a1', 'c1');
    expect(mockApi.delete).toHaveBeenCalledWith('/workshop/appointments/a1/comments/c1');
  });
});
