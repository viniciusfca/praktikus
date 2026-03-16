import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CustomersService } from './customers.service';
import { CustomerEntity } from './customer.entity';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockCustomerRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  remove: jest.fn(),
};

const mockVehicleRepo = {
  count: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === CustomerEntity) return mockCustomerRepo;
      return mockVehicleRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === CustomerEntity) return mockCustomerRepo;
      return mockVehicleRepo;
    });
    mockCustomerRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return paginated customers', async () => {
      const customers = [{ id: 'c1', nome: 'João' }];
      mockQb.getManyAndCount.mockResolvedValue([customers, 1]);

      const result = await service.list('tenant-1', 1, 20);

      expect(result).toEqual({ data: customers, total: 1, page: 1, limit: 20 });
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path'),
      );
    });

    it('should apply search filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list('tenant-1', 1, 20, 'joao');

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.any(Object),
      );
    });
  });

  describe('getById', () => {
    it('should return customer with vehicles', async () => {
      const customer = { id: 'c1', nome: 'João', vehicles: [] };
      mockCustomerRepo.findOne.mockResolvedValue(customer);

      const result = await service.getById('tenant-1', 'c1');

      expect(result).toEqual(customer);
      expect(mockCustomerRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'c1' },
        relations: ['vehicles'],
      });
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockCustomerRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and return customer', async () => {
      const dto = { nome: 'João', cpfCnpj: '12345678901' };
      const created = { id: 'c1', ...dto };
      mockCustomerRepo.create.mockReturnValue(created);
      mockCustomerRepo.save.mockResolvedValue(created);

      const result = await service.create('tenant-1', dto as any);

      expect(result).toEqual(created);
      expect(mockCustomerRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return customer', async () => {
      const customer = { id: 'c1', nome: 'João', cpfCnpj: '12345678901' };
      mockCustomerRepo.findOne.mockResolvedValue(customer);
      mockCustomerRepo.save.mockResolvedValue({ ...customer, nome: 'Maria' });

      const result = await service.update('tenant-1', 'c1', { nome: 'Maria' } as any);

      expect(mockCustomerRepo.save).toHaveBeenCalled();
      expect(result.nome).toBe('Maria');
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockCustomerRepo.findOne.mockResolvedValue(null);

      await expect(service.update('tenant-1', 'nonexistent', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should throw ConflictException when customer has vehicles', async () => {
      const customer = { id: 'c1' };
      mockCustomerRepo.findOne.mockResolvedValue(customer);
      mockVehicleRepo.count.mockResolvedValue(2);

      await expect(service.delete('tenant-1', 'c1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should delete customer when no vehicles', async () => {
      const customer = { id: 'c1' };
      mockCustomerRepo.findOne.mockResolvedValue(customer);
      mockVehicleRepo.count.mockResolvedValue(0);
      mockCustomerRepo.save = jest.fn();
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      mockCustomerRepo.remove = mockRemove;

      await service.delete('tenant-1', 'c1');

      expect(mockRemove).toHaveBeenCalledWith(customer);
    });
  });
});
