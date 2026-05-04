import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BuyersService } from './buyers.service';
import { BuyerEntity } from './buyer.entity';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockBuyerRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: { getRepository: jest.fn().mockReturnValue(mockBuyerRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

const TENANT = '00000000-0000-0000-0000-000000000001';

describe('BuyersService', () => {
  let service: BuyersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuyersService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<BuyersService>(BuyersService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockBuyerRepo);
    mockBuyerRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.orWhere.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  it('should throw on invalid tenantId', async () => {
    await expect(service.list('invalid', 1, 20)).rejects.toThrow(
      'Invalid tenantId',
    );
  });

  it('should return paginated buyers', async () => {
    mockQb.getManyAndCount.mockResolvedValue([
      [{ id: 'b1', name: 'Empresa A' }],
      1,
    ]);
    const result = await service.list(TENANT, 1, 20);
    expect(result.total).toBe(1);
  });

  it('should throw NotFoundException when buyer not found', async () => {
    mockBuyerRepo.findOne.mockResolvedValue(null);
    await expect(service.getById(TENANT, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('create', () => {
    it('creates a buyer with CNPJ', async () => {
      mockBuyerRepo.create.mockReturnValue({
        id: 'b1',
        name: 'ACME',
        document: '11222333000181',
        documentType: 'CNPJ',
      });
      mockBuyerRepo.save.mockResolvedValue({
        id: 'b1',
        name: 'ACME',
        document: '11222333000181',
        documentType: 'CNPJ',
      });
      const result = await service.create(TENANT, {
        name: 'ACME',
        document: '11222333000181',
        documentType: 'CNPJ',
      });
      expect(result.document).toBe('11222333000181');
      expect(result.documentType).toBe('CNPJ');
    });

    it('creates a buyer with CPF (pessoa física)', async () => {
      mockBuyerRepo.create.mockReturnValue({
        id: 'b2',
        name: 'João',
        document: '12345678901',
        documentType: 'CPF',
      });
      mockBuyerRepo.save.mockResolvedValue({
        id: 'b2',
        name: 'João',
        document: '12345678901',
        documentType: 'CPF',
      });
      const result = await service.create(TENANT, {
        name: 'João',
        document: '12345678901',
        documentType: 'CPF',
      });
      expect(result.document).toBe('12345678901');
      expect(result.documentType).toBe('CPF');
    });

    it('creates a buyer without document', async () => {
      mockBuyerRepo.create.mockReturnValue({
        id: 'b3',
        name: 'Anônimo',
        document: null,
        documentType: null,
      });
      mockBuyerRepo.save.mockResolvedValue({
        id: 'b3',
        name: 'Anônimo',
        document: null,
        documentType: null,
      });
      const result = await service.create(TENANT, { name: 'Anônimo' });
      expect(result.document).toBeNull();
      expect(result.documentType).toBeNull();
    });

    it('rejects create when document is set without documentType', async () => {
      await expect(
        service.create(TENANT, { name: 'X', document: '12345678901' } as any),
      ).rejects.toThrow(/document e documentType/);
    });

    it('rejects create when documentType is set without document', async () => {
      await expect(
        service.create(TENANT, { name: 'X', documentType: 'CPF' } as any),
      ).rejects.toThrow(/document e documentType/);
    });
  });

  describe('update', () => {
    it('rejects update that leaves document and documentType inconsistent', async () => {
      mockBuyerRepo.findOne.mockResolvedValue({
        id: 'b1',
        name: 'X',
        document: '11222333000181',
        documentType: 'CNPJ',
      });
      await expect(
        service.update(TENANT, 'b1', { documentType: null } as any),
      ).rejects.toThrow(/document e documentType/);
    });
  });

  it('should throw ConflictException when deleting buyer with sales', async () => {
    mockBuyerRepo.findOne.mockResolvedValue({ id: 'b1', name: 'Empresa A' });
    mockQueryRunner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SET LOCAL')) return undefined;
      if (sql.includes('COUNT')) return [{ count: '3' }];
      return undefined;
    });
    await expect(service.delete(TENANT, 'b1')).rejects.toThrow(
      ConflictException,
    );
  });
});
