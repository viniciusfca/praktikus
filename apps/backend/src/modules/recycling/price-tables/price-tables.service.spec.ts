import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PriceTablesService } from './price-tables.service';

describe('PriceTablesService', () => {
  let service: PriceTablesService;
  let mockManager: { getRepository: jest.Mock };
  let mockQueryRunner: {
    connect: jest.Mock;
    query: jest.Mock;
    release: jest.Mock;
    manager: typeof mockManager;
  };

  beforeEach(async () => {
    mockManager = { getRepository: jest.fn() };
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: mockManager,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceTablesService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: () => mockQueryRunner,
          },
        },
      ],
    }).compile();

    service = module.get(PriceTablesService);
  });

  it('list() rejeita tenantId inválido', async () => {
    await expect(service.list('not-a-uuid')).rejects.toThrow('Invalid tenantId');
  });

  it('list() seta search_path e retorna tabelas ativas ordenadas', async () => {
    const tabelas = [
      { id: 't1', name: 'Tabela 1 — Padrão', sortOrder: 1, isDefault: true },
    ];
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(tabelas),
    };
    mockManager.getRepository.mockReturnValue({
      createQueryBuilder: () => qb,
    });

    const result = await service.list('11111111-1111-1111-1111-111111111111');

    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      'SET search_path TO "tenant_11111111111111111111111111111111", public',
    );
    expect(qb.where).toHaveBeenCalledWith('pt.active = :active', {
      active: true,
    });
    expect(qb.orderBy).toHaveBeenCalledWith('pt.sortOrder', 'ASC');
    expect(result).toEqual(tabelas);
    expect(mockQueryRunner.release).toHaveBeenCalled();
  });

  it('getDefault() retorna a única tabela default ativa', async () => {
    const tabela = { id: 't1', isDefault: true, active: true };
    mockManager.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(tabela),
    });

    const result = await service.getDefault(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(result).toBe(tabela);
  });

  it('getDefault() falha quando não há tabela default', async () => {
    mockManager.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.getDefault('11111111-1111-1111-1111-111111111111'),
    ).rejects.toThrow('Tabela padrão não encontrada');
  });
});
