import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ProductsService } from './products.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const T1 = '22222222-2222-2222-2222-222222222222';
const T2 = '33333333-3333-3333-3333-333333333333';
const T3 = '44444444-4444-4444-4444-444444444444';
const PRODUCT = '55555555-5555-5555-5555-555555555555';

describe('ProductsService.create', () => {
  let service: ProductsService;
  let priceTableRepo: { find: jest.Mock };
  let productRepo: { create: jest.Mock; save: jest.Mock };
  let productPriceRepo: {
    upsert: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
  };
  let txManager: { getRepository: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    manager: typeof txManager;
  };

  beforeEach(async () => {
    priceTableRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: T1,
          isDefault: true,
          active: true,
          sortOrder: 1,
          name: 'Tabela 1 — Padrão',
        },
        {
          id: T2,
          isDefault: false,
          active: true,
          sortOrder: 2,
          name: 'Tabela 2',
        },
        {
          id: T3,
          isDefault: false,
          active: true,
          sortOrder: 3,
          name: 'Tabela 3',
        },
      ]),
    };
    productRepo = {
      create: jest.fn().mockImplementation((p) => ({ id: PRODUCT, ...p })),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    productPriceRepo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
    };
    txManager = {
      getRepository: jest.fn((entity) => {
        const name = (entity as { name: string }).name;
        if (name === 'PriceTableEntity') return priceTableRepo;
        if (name === 'ProductEntity') return productRepo;
        if (name === 'ProductPriceEntity') return productPriceRepo;
        throw new Error(`unexpected entity ${name}`);
      }),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      manager: txManager,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: DataSource,
          useValue: { createQueryRunner: () => queryRunner },
        },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('cria produto com 3 preços e sincroniza pricePerUnit com a Tabela 1', async () => {
    await service.create(TENANT, {
      name: 'Alumínio',
      unitId: 'unit-id-uuid-here-aaaaaaaaaaaa',
      prices: { [T1]: 8.0, [T2]: 8.5, [T3]: 9.0 },
    } as never);

    expect(productPriceRepo.upsert).toHaveBeenCalledTimes(3);
    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ pricePerUnit: 8.0 }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('rejeita criação sem preço da tabela padrão', async () => {
    await expect(
      service.create(TENANT, {
        name: 'X',
        unitId: 'unit-id',
        prices: { [T2]: 5 },
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('rejeita IDs de tabela inexistentes', async () => {
    await expect(
      service.create(TENANT, {
        name: 'X',
        unitId: 'unit-id',
        prices: { [T1]: 5, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 1 },
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('null em t2 não cria entry pra t2', async () => {
    await service.create(TENANT, {
      name: 'X',
      unitId: 'unit-id',
      prices: { [T1]: 5, [T2]: null },
    } as never);

    const upsertCalls = productPriceRepo.upsert.mock.calls;
    const upsertedTableIds = upsertCalls.map(
      ([row]: [{ priceTableId: string }]) => row.priceTableId,
    );
    expect(upsertedTableIds).toEqual([T1]);
    expect(productPriceRepo.delete).not.toHaveBeenCalled();
  });

  it('lança InternalServerErrorException quando não há tabela padrão ativa', async () => {
    priceTableRepo.find.mockResolvedValue([
      { id: T1, isDefault: false, active: true, sortOrder: 1 },
    ]);
    await expect(
      service.create(TENANT, {
        name: 'X',
        unitId: 'uid',
        prices: { [T1]: 5 },
      } as never),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});

describe('ProductsService.update', () => {
  let service: ProductsService;
  let priceTableRepo: { find: jest.Mock };
  let productRepo: { findOne: jest.Mock; save: jest.Mock };
  let productPriceRepo: {
    upsert: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
  };
  let txManager: { getRepository: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    manager: typeof txManager;
  };

  beforeEach(async () => {
    priceTableRepo = {
      find: jest.fn().mockResolvedValue([
        { id: T1, isDefault: true, active: true, sortOrder: 1 },
        { id: T2, isDefault: false, active: true, sortOrder: 2 },
        { id: T3, isDefault: false, active: true, sortOrder: 3 },
      ]),
    };
    productRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: PRODUCT,
        name: 'Alumínio',
        unitId: 'u',
        pricePerUnit: 8,
        active: true,
      }),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    productPriceRepo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
    };
    txManager = {
      getRepository: jest.fn((entity) => {
        const name = (entity as { name: string }).name;
        if (name === 'PriceTableEntity') return priceTableRepo;
        if (name === 'ProductEntity') return productRepo;
        if (name === 'ProductPriceEntity') return productPriceRepo;
        throw new Error(`unexpected entity ${name}`);
      }),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      manager: txManager,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: DataSource,
          useValue: { createQueryRunner: () => queryRunner },
        },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('PATCH com null em t2 deleta entry existente em t2', async () => {
    await service.update(TENANT, PRODUCT, {
      prices: { [T1]: 9, [T2]: null },
    } as never);

    const deleteCalls = productPriceRepo.delete.mock.calls;
    expect(deleteCalls).toContainEqual([
      { productId: PRODUCT, priceTableId: T2 },
    ]);

    const upsertCalls = productPriceRepo.upsert.mock.calls;
    const upsertedTableIds = upsertCalls.map(
      ([row]: [{ priceTableId: string }]) => row.priceTableId,
    );
    expect(upsertedTableIds).toContain(T1);

    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ pricePerUnit: 9 }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('PATCH sem prices preserva entries existentes', async () => {
    await service.update(TENANT, PRODUCT, { name: 'Novo nome' } as never);

    expect(productPriceRepo.upsert).not.toHaveBeenCalled();
    expect(productPriceRepo.delete).not.toHaveBeenCalled();
    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Novo nome', pricePerUnit: 8 }),
    );
  });

  it('PATCH com prices mas sem padrão presente é rejeitado', async () => {
    await expect(
      service.update(TENANT, PRODUCT, { prices: { [T2]: 5 } } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});

describe('ProductsService.list e getById', () => {
  let service: ProductsService;
  let productRepo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let productPriceRepo: { find: jest.Mock };
  let priceTableRepo: { find: jest.Mock };
  let schemaManager: { getRepository: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    query: jest.Mock;
    release: jest.Mock;
    manager: typeof schemaManager;
  };

  const PRODUTO = {
    id: PRODUCT,
    name: 'Alumínio',
    unitId: 'u',
    active: true,
    pricePerUnit: 8,
  };

  beforeEach(async () => {
    priceTableRepo = {
      find: jest.fn().mockResolvedValue([
        { id: T1, isDefault: true, active: true, sortOrder: 1 },
        { id: T2, isDefault: false, active: true, sortOrder: 2 },
      ]),
    };
    productPriceRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          { productId: PRODUCT, priceTableId: T1, price: '8.00' },
        ]),
    };
    productRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([PRODUTO]),
      }),
      findOne: jest.fn().mockResolvedValue(PRODUTO),
    };
    schemaManager = {
      getRepository: jest.fn((entity) => {
        const name = (entity as { name: string }).name;
        if (name === 'PriceTableEntity') return priceTableRepo;
        if (name === 'ProductEntity') return productRepo;
        if (name === 'ProductPriceEntity') return productPriceRepo;
        throw new Error(`unexpected entity ${name}`);
      }),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: schemaManager,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: DataSource,
          useValue: { createQueryRunner: () => queryRunner },
        },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('list() retorna produtos com mapa de preços', async () => {
    const result = await service.list(TENANT, true);
    expect(result).toHaveLength(1);
    expect(result[0].prices[T1]).toBe(8);
    expect(result[0].prices[T2]).toBeNull();
  });

  it('list() seta search_path correto', async () => {
    await service.list(TENANT, true);
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('SET search_path'),
    );
  });

  it('list() rejeita tenantId inválido', async () => {
    await expect(service.list('not-a-uuid', true)).rejects.toThrow(
      'Invalid tenantId',
    );
  });

  it('getById() retorna produto com preços', async () => {
    const result = await service.getById(TENANT, PRODUCT);
    expect(result.id).toBe(PRODUCT);
    expect(result.prices[T1]).toBe(8);
  });

  it('getById() lança NotFoundException para produto inexistente', async () => {
    productRepo.findOne.mockResolvedValue(null);
    await expect(service.getById(TENANT, PRODUCT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('list() sem includeInactive aplica filtro where active', async () => {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([PRODUTO]),
    };
    productRepo.createQueryBuilder.mockReturnValue(qb);

    await service.list(TENANT); // includeInactive defaults to false
    expect(qb.where).toHaveBeenCalledWith('product.active = :active', {
      active: true,
    });
  });

});
