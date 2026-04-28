import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ColetaStatus } from '@praktikus/shared';
import { ColetasService } from './coletas.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'c1', ...x })),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const supplierRepo = mockRepo();
const userRepo = mockRepo();
const coletaRepo = mockRepo();

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'SupplierEntity') return supplierRepo;
      if (entity.name === 'UserEntity') return userRepo;
      if (entity.name === 'ColetaEntity') return coletaRepo;
      return mockRepo();
    }),
  },
};
const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('ColetasService', () => {
  let service: ColetasService;
  const TENANT = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColetasService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<ColetasService>(ColetasService);
    jest.clearAllMocks();
  });

  it('throws on invalid tenantId', async () => {
    await expect(
      service.create('bad-id', {
        supplierId: 'x',
        scheduledAt: '2026-04-20T10:00:00Z',
      } as any),
    ).rejects.toThrow('Invalid tenantId');
  });

  describe('create', () => {
    it('creates coleta when supplier exists', async () => {
      supplierRepo.findOne.mockResolvedValue({ id: 'sup1', name: 'S' });
      coletaRepo.save.mockResolvedValue({
        id: 'c1',
        supplierId: 'sup1',
        employeeId: null,
        scheduledAt: new Date(),
        status: ColetaStatus.AGENDADA,
        notes: null,
      });

      const result = await service.create(TENANT, {
        supplierId: 'sup1',
        scheduledAt: '2026-04-20T10:00:00Z',
      } as any);

      expect(result.id).toBe('c1');
      expect(result.status).toBe(ColetaStatus.AGENDADA);
    });

    it('throws if supplier does not exist', async () => {
      supplierRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(TENANT, {
          supplierId: 'missing',
          scheduledAt: '2026-04-20T10:00:00Z',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if employee is not EMPLOYEE role', async () => {
      supplierRepo.findOne.mockResolvedValue({ id: 'sup1' });
      userRepo.findOne.mockResolvedValue({ id: 'u1', role: 'OWNER' });
      await expect(
        service.create(TENANT, {
          supplierId: 'sup1',
          employeeId: 'u1',
          scheduledAt: '2026-04-20T10:00:00Z',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('allows field updates on AGENDADA coleta', async () => {
      coletaRepo.findOne.mockResolvedValue({
        id: 'c1',
        status: ColetaStatus.AGENDADA,
        supplierId: 'sup1',
        employeeId: null,
        scheduledAt: new Date(),
        notes: null,
      });
      supplierRepo.findOne.mockResolvedValue({ id: 'sup2' });
      coletaRepo.save.mockResolvedValue({
        id: 'c1',
        supplierId: 'sup2',
        status: ColetaStatus.AGENDADA,
      });

      const result = await service.update(TENANT, 'c1', {
        supplierId: 'sup2',
      } as any);
      expect(result.supplierId).toBe('sup2');
    });

    it('rejects update on CONCLUIDA coleta', async () => {
      coletaRepo.findOne.mockResolvedValue({
        id: 'c1',
        status: ColetaStatus.CONCLUIDA,
      });
      await expect(
        service.update(TENANT, 'c1', { notes: 'new note' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects update on CANCELADA coleta', async () => {
      coletaRepo.findOne.mockResolvedValue({
        id: 'c1',
        status: ColetaStatus.CANCELADA,
      });
      await expect(
        service.update(TENANT, 'c1', {
          scheduledAt: '2026-05-01T10:00:00Z',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('404 if coleta not found', async () => {
      coletaRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(TENANT, 'x', { notes: 'n' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('allows AGENDADA → CONCLUIDA', async () => {
      coletaRepo.findOne.mockResolvedValue({
        id: 'c1',
        status: ColetaStatus.AGENDADA,
      });
      coletaRepo.save.mockResolvedValue({
        id: 'c1',
        status: ColetaStatus.CONCLUIDA,
      });
      const result = await service.updateStatus(
        TENANT,
        'c1',
        ColetaStatus.CONCLUIDA,
      );
      expect(result.status).toBe(ColetaStatus.CONCLUIDA);
    });

    it('rejects CONCLUIDA → CANCELADA', async () => {
      coletaRepo.findOne.mockResolvedValue({
        id: 'c1',
        status: ColetaStatus.CONCLUIDA,
      });
      await expect(
        service.updateStatus(TENANT, 'c1', ColetaStatus.CANCELADA),
      ).rejects.toThrow(BadRequestException);
    });

    it('404 if not found', async () => {
      coletaRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus(TENANT, 'x', ColetaStatus.CONCLUIDA),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes AGENDADA coleta', async () => {
      coletaRepo.findOne.mockResolvedValue({
        id: 'c1',
        status: ColetaStatus.AGENDADA,
      });
      await service.delete(TENANT, 'c1');
      expect(coletaRepo.remove).toHaveBeenCalled();
    });

    it('refuses to delete CONCLUIDA', async () => {
      coletaRepo.findOne.mockResolvedValue({
        id: 'c1',
        status: ColetaStatus.CONCLUIDA,
      });
      await expect(service.delete(TENANT, 'c1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('upcoming', () => {
    it('returns AGENDADA coletas ordered by scheduledAt ASC with limit', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
      };
      coletaRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.upcoming(TENANT, 4);
      expect(result).toHaveLength(2);
      expect(qb.where).toHaveBeenCalledWith('c.status = :status', {
        status: ColetaStatus.AGENDADA,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('c.scheduledAt', 'ASC');
      expect(qb.limit).toHaveBeenCalledWith(4);
    });
  });
});
