import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProductsService } from './products.service';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

const mockProductRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: { getRepository: jest.fn().mockReturnValue(mockProductRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockProductRepo);
    mockProductRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  it('should list active products by default', async () => {
    const products = [{ id: 'p1', name: 'Papelão', active: true }];
    mockQb.getMany.mockResolvedValue(products);
    const result = await service.list('00000000-0000-0000-0000-000000000001');
    expect(result).toEqual(products);
    expect(mockQb.where).toHaveBeenCalledWith('product.active = :active', { active: true });
  });

  it('should list all products when includeInactive is true', async () => {
    const products = [
      { id: 'p1', name: 'Papelão', active: true },
      { id: 'p2', name: 'Ferro Velho', active: false },
    ];
    mockQb.getMany.mockResolvedValue(products);
    const result = await service.list('00000000-0000-0000-0000-000000000001', true);
    expect(result).toEqual(products);
    expect(mockQb.where).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when product not found', async () => {
    mockProductRepo.findOne.mockResolvedValue(null);
    await expect(
      service.getById('00000000-0000-0000-0000-000000000001', 'missing')
    ).rejects.toThrow(NotFoundException);
  });

  it('should create a product', async () => {
    const dto = { name: 'Papelão', unitId: 'unit-1', pricePerUnit: 0.5 };
    const created = { id: 'p1', ...dto, active: true };
    mockProductRepo.create.mockReturnValue(created);
    mockProductRepo.save.mockResolvedValue(created);
    const result = await service.create('00000000-0000-0000-0000-000000000001', dto);
    expect(result).toEqual(created);
  });

  it('should update product fields', async () => {
    const product = { id: 'p1', name: 'Papelão', pricePerUnit: 0.5, active: true };
    mockProductRepo.findOne.mockResolvedValue(product);
    mockProductRepo.save.mockResolvedValue({ ...product, pricePerUnit: 0.75 });
    const result = await service.update('00000000-0000-0000-0000-000000000001', 'p1', { pricePerUnit: 0.75 });
    expect(result.pricePerUnit).toBe(0.75);
  });

  it('should throw NotFoundException on update when not found', async () => {
    mockProductRepo.findOne.mockResolvedValue(null);
    await expect(
      service.update('00000000-0000-0000-0000-000000000001', 'missing', { name: 'X' })
    ).rejects.toThrow(NotFoundException);
  });
});
