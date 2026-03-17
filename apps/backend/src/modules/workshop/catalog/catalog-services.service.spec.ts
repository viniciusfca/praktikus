import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CatalogServicesService } from './catalog-services.service';
import { CatalogServiceEntity } from './catalog-service.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: { getRepository: jest.fn().mockReturnValue(mockRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('CatalogServicesService', () => {
  let service: CatalogServicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogServicesService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<CatalogServicesService>(CatalogServicesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockRepo);
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return paginated services and set search_path', async () => {
      const items = [{ id: 's1', nome: 'Troca de óleo' }];
      mockQb.getManyAndCount.mockResolvedValue([items, 1]);

      const result = await service.list(TENANT_ID, 1, 20);

      expect(result).toEqual({ data: items, total: 1, page: 1, limit: 20 });
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path'),
      );
    });

    it('should apply search filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list(TENANT_ID, 1, 20, 'oleo');

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.any(Object),
      );
    });
  });

  describe('getById', () => {
    it('should return service when found', async () => {
      const item = { id: 's1', nome: 'Troca de óleo' };
      mockRepo.findOne.mockResolvedValue(item);

      const result = await service.getById(TENANT_ID, 's1');

      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return service', async () => {
      const dto = { nome: 'Troca de óleo', precoPadrao: 80 };
      const created = { id: 's1', ...dto };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(TENANT_ID, dto as any);

      expect(result).toEqual(created);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return service', async () => {
      const item = { id: 's1', nome: 'Troca de óleo', precoPadrao: 80 };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, nome: 'Troca de filtro' });

      const result = await service.update(TENANT_ID, 's1', { nome: 'Troca de filtro' } as any);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.nome).toBe('Troca de filtro');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update(TENANT_ID, 'nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete service when found', async () => {
      const item = { id: 's1' };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.delete(TENANT_ID, 's1');

      expect(mockRepo.remove).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
