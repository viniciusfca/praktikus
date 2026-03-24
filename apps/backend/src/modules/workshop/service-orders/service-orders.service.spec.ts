import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrderEntity } from './service-order.entity';
import { SoItemServiceEntity } from './so-item-service.entity';
import { SoItemPartEntity } from './so-item-part.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SO_ID = '00000000-0000-0000-0000-000000000010';

const mockQb = {
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

const mockSoRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockItemServiceRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockItemPartRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity: any) => {
      if (entity?.name === 'ServiceOrderEntity') return mockSoRepo;
      if (entity?.name === 'SoItemServiceEntity') return mockItemServiceRepo;
      return mockItemPartRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  query: jest.fn().mockResolvedValue(undefined),
};

describe('ServiceOrdersService', () => {
  let service: ServiceOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceOrdersService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<ServiceOrdersService>(ServiceOrdersService);
    jest.clearAllMocks();
    mockQueryRunner.query.mockResolvedValue(undefined);
    mockQueryRunner.manager.getRepository.mockImplementation((entity: any) => {
      if (entity?.name === 'ServiceOrderEntity') return mockSoRepo;
      if (entity?.name === 'SoItemServiceEntity') return mockItemServiceRepo;
      return mockItemPartRepo;
    });
    mockSoRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.andWhere.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return service orders and set search_path', async () => {
      const items = [{ id: SO_ID, status: 'ORCAMENTO' }];
      mockQb.getMany.mockResolvedValue(items);
      const result = await service.list(TENANT_ID, {});
      expect(result).toEqual(items);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(expect.stringContaining('SET search_path'));
    });

    it('should apply status filter', async () => {
      mockQb.getMany.mockResolvedValue([]);
      await service.list(TENANT_ID, { status: 'APROVADO' });
      expect(mockQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('status'), expect.any(Object));
    });
  });

  describe('getById', () => {
    it('should return SO with items when found', async () => {
      const so = { id: SO_ID, status: 'ORCAMENTO' };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockItemServiceRepo.find.mockResolvedValue([]);
      mockItemPartRepo.find.mockResolvedValue([]);
      const result = await service.getById(TENANT_ID, SO_ID);
      expect(result.id).toBe(SO_ID);
      expect(result).toHaveProperty('itemsServices');
      expect(result).toHaveProperty('itemsParts');
    });

    it('should throw NotFoundException when not found', async () => {
      mockSoRepo.findOne.mockResolvedValue(null);
      await expect(service.getById(TENANT_ID, SO_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return service order', async () => {
      const dto = {
        clienteId: '00000000-0000-0000-0000-000000000002',
        veiculoId: '00000000-0000-0000-0000-000000000003',
      };
      const created = { id: SO_ID, ...dto, status: 'ORCAMENTO' };
      mockSoRepo.create.mockReturnValue(created);
      mockSoRepo.save.mockResolvedValue(created);
      const result = await service.create(TENANT_ID, dto as any);
      expect(result.id).toBe(SO_ID);
      expect(result.status).toBe('ORCAMENTO');
    });
  });

  describe('patchStatus', () => {
    it('should transition status for valid move', async () => {
      const so = { id: SO_ID, status: 'ORCAMENTO', approvalToken: null };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockSoRepo.save.mockResolvedValue({ ...so, status: 'APROVADO' });
      const result = await service.patchStatus(TENANT_ID, SO_ID, 'APROVADO', 'OWNER');
      expect(result.status).toBe('APROVADO');
    });

    it('should throw BadRequestException for invalid transition', async () => {
      const so = { id: SO_ID, status: 'ORCAMENTO' };
      mockSoRepo.findOne.mockResolvedValue(so);
      await expect(service.patchStatus(TENANT_ID, SO_ID, 'ENTREGUE', 'OWNER')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if EMPLOYEE tries to transition from APROVADO', async () => {
      const so = { id: SO_ID, status: 'APROVADO' };
      mockSoRepo.findOne.mockResolvedValue(so);
      await expect(service.patchStatus(TENANT_ID, SO_ID, 'EM_EXECUCAO', 'EMPLOYEE')).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateApprovalToken', () => {
    it('should generate token for ORCAMENTO status', async () => {
      const so = { id: SO_ID, status: 'ORCAMENTO', approvalToken: null, approvalExpiresAt: null };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockSoRepo.save.mockResolvedValue(so);
      mockDataSource.query.mockResolvedValue(undefined);
      const result = await service.generateApprovalToken(TENANT_ID, SO_ID);
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
    });

    it('should throw BadRequestException if status is not ORCAMENTO', async () => {
      const so = { id: SO_ID, status: 'APROVADO' };
      mockSoRepo.findOne.mockResolvedValue(so);
      await expect(service.generateApprovalToken(TENANT_ID, SO_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('addItemService', () => {
    it('should add item when SO exists', async () => {
      const so = { id: SO_ID };
      const item = { id: 'item1', soId: SO_ID };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockItemServiceRepo.create.mockReturnValue(item);
      mockItemServiceRepo.save.mockResolvedValue(item);
      const dto = { catalogServiceId: '00000000-0000-0000-0000-000000000099', nomeServico: 'Troca de óleo', valor: 150 };
      const result = await service.addItemService(TENANT_ID, SO_ID, dto as any);
      expect(result.id).toBe('item1');
    });

    it('should throw NotFoundException when SO not found', async () => {
      mockSoRepo.findOne.mockResolvedValue(null);
      await expect(service.addItemService(TENANT_ID, SO_ID, {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete SO when found', async () => {
      const so = { id: SO_ID, approvalToken: null };
      mockSoRepo.findOne.mockResolvedValue(so);
      mockSoRepo.remove.mockResolvedValue(undefined);
      await service.delete(TENANT_ID, SO_ID);
      expect(mockSoRepo.remove).toHaveBeenCalledWith(so);
    });

    it('should throw NotFoundException when not found', async () => {
      mockSoRepo.findOne.mockResolvedValue(null);
      await expect(service.delete(TENANT_ID, SO_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
