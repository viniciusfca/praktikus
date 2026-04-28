import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  BadGatewayException,
  NotFoundException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { CepService } from './cep.service';

describe('CepService', () => {
  let service: CepService;
  let httpGet: jest.Mock;

  beforeEach(async () => {
    httpGet = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CepService,
        { provide: HttpService, useValue: { get: httpGet } },
      ],
    }).compile();
    service = module.get<CepService>(CepService);
  });

  function ok<T>(data: T): AxiosResponse<T> {
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };
  }

  function axiosErr(status?: number): AxiosError {
    const err = new AxiosError('boom');
    if (status)
      err.response = {
        status,
        data: null,
        statusText: '',
        headers: {},
        config: {} as any,
      };
    return err;
  }

  it('rejects CEPs with fewer than 8 digits', async () => {
    await expect(service.lookup('123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects CEPs with non-digit characters that result in fewer than 8 digits', async () => {
    await expect(service.lookup('abc-def')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('normalizes CEP with hyphen and calls ceplite first', async () => {
    httpGet.mockReturnValueOnce(
      of(
        ok({
          cep: '69921-001',
          logradouro: 'Rua A',
          bairro: 'Centro',
          cidade: 'Rio Branco',
          uf: 'AC',
        }),
      ),
    );
    const result = await service.lookup('69921-001');
    expect(httpGet).toHaveBeenCalledWith(
      'https://ceplite.com.br/cep/69921001',
      expect.any(Object),
    );
    expect(result).toEqual({
      cep: '69921001',
      street: 'Rua A',
      neighborhood: 'Centro',
      city: 'Rio Branco',
      state: 'AC',
    });
  });

  it('falls back to viacep when ceplite times out', async () => {
    httpGet
      .mockReturnValueOnce(throwError(() => axiosErr()))
      .mockReturnValueOnce(
        of(
          ok({
            cep: '01001-000',
            logradouro: 'Praça da Sé',
            bairro: 'Sé',
            localidade: 'São Paulo',
            uf: 'SP',
          }),
        ),
      );
    const result = await service.lookup('01001000');
    expect(httpGet).toHaveBeenCalledTimes(2);
    expect(httpGet).toHaveBeenNthCalledWith(
      2,
      'https://viacep.com.br/ws/01001000/json/',
      expect.any(Object),
    );
    expect(result.city).toBe('São Paulo');
    expect(result.state).toBe('SP');
  });

  it('returns 404 when both APIs say CEP does not exist', async () => {
    httpGet
      .mockReturnValueOnce(throwError(() => axiosErr(404)))
      .mockReturnValueOnce(of(ok({ erro: true })));
    await expect(service.lookup('00000000')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns 502 when both APIs fail with network errors', async () => {
    httpGet
      .mockReturnValueOnce(throwError(() => axiosErr()))
      .mockReturnValueOnce(throwError(() => axiosErr()));
    await expect(service.lookup('12345678')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('falls back when ceplite returns malformed payload', async () => {
    httpGet
      .mockReturnValueOnce(of(ok({ unexpected: 'shape' })))
      .mockReturnValueOnce(
        of(
          ok({
            cep: '01001-000',
            logradouro: 'Praça da Sé',
            bairro: 'Sé',
            localidade: 'São Paulo',
            uf: 'SP',
          }),
        ),
      );
    const result = await service.lookup('01001000');
    expect(result.state).toBe('SP');
  });

  it('accepts ceplite response with empty street/neighborhood (general city CEP)', async () => {
    httpGet.mockReturnValueOnce(
      of(
        ok({
          cep: '69900-000',
          logradouro: '',
          bairro: '',
          cidade: 'Rio Branco',
          uf: 'AC',
        }),
      ),
    );
    const result = await service.lookup('69900000');
    expect(result).toEqual({
      cep: '69900000',
      street: '',
      neighborhood: '',
      city: 'Rio Branco',
      state: 'AC',
    });
  });
});
