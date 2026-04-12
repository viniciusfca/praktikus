import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SuppliersService } from './suppliers.service';
import { SupplierEntity } from './supplier.entity';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockSupplierRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: { getRepository: jest.fn().mockReturnValue(mockSupplierRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('SuppliersService', () => {
  let service: SuppliersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<SuppliersService>(SuppliersService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockSupplierRepo);
    mockSupplierRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.orWhere.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return paginated suppliers', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[{ id: 's1', name: 'João' }], 1]);
      const result = await service.list('00000000-0000-0000-0000-000000000001', 1, 20);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(expect.stringContaining('SET search_path'));
    });

    it('should apply search filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.list('00000000-0000-0000-0000-000000000001', 1, 20, 'joao');
      expect(mockQb.where).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should throw NotFoundException when supplier not found', async () => {
      mockSupplierRepo.findOne.mockResolvedValue(null);
      await expect(service.getById('00000000-0000-0000-0000-000000000001', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should return supplier when found', async () => {
      const supplier = { id: 's1', name: 'João' };
      mockSupplierRepo.findOne.mockResolvedValue(supplier);
      const result = await service.getById('00000000-0000-0000-0000-000000000001', 's1');
      expect(result).toEqual(supplier);
    });
  });

  describe('create', () => {
    it('should create and return supplier', async () => {
      const dto = { name: 'João', document: '12345678901', documentType: 'CPF' as const };
      const created = { id: 's1', ...dto };
      mockSupplierRepo.create.mockReturnValue(created);
      mockSupplierRepo.save.mockResolvedValue(created);
      const result = await service.create('00000000-0000-0000-0000-000000000001', dto);
      expect(result.name).toBe('João');
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when supplier not found', async () => {
      mockSupplierRepo.findOne.mockResolvedValue(null);
      await expect(service.update('00000000-0000-0000-0000-000000000001', 'missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('should update and return supplier', async () => {
      const supplier = { id: 's1', name: 'João', phone: null };
      mockSupplierRepo.findOne.mockResolvedValue(supplier);
      mockSupplierRepo.save.mockResolvedValue({ ...supplier, phone: '11999999999' });
      const result = await service.update('00000000-0000-0000-0000-000000000001', 's1', { phone: '11999999999' });
      expect(result.phone).toBe('11999999999');
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException when supplier not found', async () => {
      mockSupplierRepo.findOne.mockResolvedValue(null);
      await expect(service.delete('00000000-0000-0000-0000-000000000001', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when supplier has purchases', async () => {
      const supplier = { id: 's1' };
      mockSupplierRepo.findOne.mockResolvedValue(supplier);
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([{ count: '3' }]); // purchases count
      await expect(service.delete('00000000-0000-0000-0000-000000000001', 's1')).rejects.toThrow(ConflictException);
    });

    it('should delete supplier when no purchases', async () => {
      const supplier = { id: 's1' };
      mockSupplierRepo.findOne.mockResolvedValue(supplier);
      mockSupplierRepo.remove = jest.fn().mockResolvedValue(undefined);
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([{ count: '0' }]); // no purchases
      await service.delete('00000000-0000-0000-0000-000000000001', 's1');
      expect(mockSupplierRepo.remove).toHaveBeenCalledWith(supplier);
    });
  });
});
