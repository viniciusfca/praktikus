import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
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
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

const TENANT = '00000000-0000-0000-0000-000000000001';

describe('BuyersService', () => {
  let service: BuyersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BuyersService, { provide: DataSource, useValue: mockDataSource }],
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
    await expect(service.list('invalid', 1, 20)).rejects.toThrow('Invalid tenantId');
  });

  it('should return paginated buyers', async () => {
    mockQb.getManyAndCount.mockResolvedValue([[{ id: 'b1', name: 'Empresa A' }], 1]);
    const result = await service.list(TENANT, 1, 20);
    expect(result.total).toBe(1);
  });

  it('should throw NotFoundException when buyer not found', async () => {
    mockBuyerRepo.findOne.mockResolvedValue(null);
    await expect(service.getById(TENANT, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('should create a buyer', async () => {
    const dto = { name: 'Empresa Recicla', cnpj: '12345678000195' };
    const created = { id: 'b1', ...dto };
    mockBuyerRepo.create.mockReturnValue(created);
    mockBuyerRepo.save.mockResolvedValue(created);
    const result = await service.create(TENANT, dto);
    expect(result.name).toBe('Empresa Recicla');
  });

  it('should throw ConflictException when deleting buyer with sales', async () => {
    mockBuyerRepo.findOne.mockResolvedValue({ id: 'b1', name: 'Empresa A' });
    mockQueryRunner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SET LOCAL')) return undefined;
      if (sql.includes('COUNT')) return [{ count: '3' }];
      return undefined;
    });
    await expect(service.delete(TENANT, 'b1')).rejects.toThrow(ConflictException);
  });
});
