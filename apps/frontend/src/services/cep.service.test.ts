import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: { get: vi.fn() },
}));

import { lookupCep } from './cep.service';
import { api } from './api';
const mockApi = api as any;

describe('lookupCep', () => {
  beforeEach(() => vi.clearAllMocks());

  it('strips non-digits before calling the backend', async () => {
    mockApi.get.mockResolvedValue({
      data: { cep: '01001000', street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' },
    });
    const result = await lookupCep('01001-000');
    expect(mockApi.get).toHaveBeenCalledWith('/cep/01001000');
    expect(result.city).toBe('São Paulo');
  });

  it('propagates errors from axios', async () => {
    mockApi.get.mockRejectedValue({ response: { status: 404 } });
    await expect(lookupCep('00000000')).rejects.toMatchObject({ response: { status: 404 } });
  });
});
