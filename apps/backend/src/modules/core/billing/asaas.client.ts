import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class AsaasError extends Error {
  constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Asaas ${method} ${path} failed: ${status} ${body}`);
  }
}

@Injectable()
export class AsaasClient {
  private readonly logger = new Logger(AsaasClient.name);
  readonly isMock: boolean;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('ASAAS_API_KEY') ?? '';
    this.isMock = !key || key === 'mock';
    this.apiKey = key;
    this.baseUrl = this.config.get<string>(
      'ASAAS_API_URL',
      'https://sandbox.asaas.com/api/v3',
    );
    if (this.isMock) {
      this.logger.warn(
        'AsaasClient em modo MOCK — chamadas externas desabilitadas.',
      );
    }
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        access_token: this.apiKey,
      },
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw new Error(
        `Asaas network error on ${method} ${path}: ${(err as Error).message}`,
      );
    }
    if (!res.ok) {
      const text = await res.text();
      throw new AsaasError(method, path, res.status, text);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
