import { ConfigService } from '@nestjs/config';
import { AsaasClient } from './asaas.client';

const mockConfig = (overrides: Record<string, string> = {}) =>
  ({
    get: jest.fn((key: string, fallback?: string) => {
      const map: Record<string, string> = {
        ASAAS_API_KEY: 'real_key',
        ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
        ...overrides,
      };
      return map[key] ?? fallback;
    }),
  }) as unknown as ConfigService;

describe('AsaasClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => jest.restoreAllMocks());

  it('detects mock mode when ASAAS_API_KEY=mock', () => {
    const client = new AsaasClient(mockConfig({ ASAAS_API_KEY: 'mock' }));
    expect(client.isMock).toBe(true);
  });

  it('detects mock mode when ASAAS_API_KEY is empty', () => {
    const client = new AsaasClient(mockConfig({ ASAAS_API_KEY: '' }));
    expect(client.isMock).toBe(true);
  });

  it('sends access_token header on real calls', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 'cus_123' }),
    });
    const client = new AsaasClient(mockConfig());
    await client.post('/customers', { name: 'foo' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://sandbox.asaas.com/api/v3/customers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          access_token: 'real_key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ name: 'foo' }),
      }),
    );
  });

  it('throws AsaasError on non-2xx with status and body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"errors":[{"description":"invalid cnpj"}]}',
    });
    const client = new AsaasClient(mockConfig());
    await expect(client.post('/customers', {})).rejects.toThrow(
      /Asaas POST \/customers failed: 400/,
    );
  });

  it('throws on network error with descriptive message', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const client = new AsaasClient(mockConfig());
    await expect(client.post('/customers', {})).rejects.toThrow(
      /Asaas network error.*ECONNREFUSED/,
    );
  });

  it('supports GET, PATCH, DELETE methods', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '{}' });
    const client = new AsaasClient(mockConfig());
    await client.get('/foo');
    await client.patch('/foo', { x: 1 });
    await client.delete('/foo');
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][1].method).toBe('GET');
    expect(calls[1][1].method).toBe('PATCH');
    expect(calls[2][1].method).toBe('DELETE');
  });

  it('returns undefined when 2xx response body is empty (e.g. DELETE)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => '',
    });
    const client = new AsaasClient(mockConfig());
    const result = await client.delete('/foo');
    expect(result).toBeUndefined();
  });
});
