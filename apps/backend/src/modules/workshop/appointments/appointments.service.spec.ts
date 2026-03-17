import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppointmentsService } from './appointments.service';
import { AppointmentEntity } from './appointment.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const mockQb = {
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
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
  query: jest.fn().mockResolvedValue([]),
  manager: { getRepository: jest.fn().mockReturnValue(mockRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<AppointmentsService>(AppointmentsService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockRepo);
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.andWhere.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
    mockQueryRunner.query.mockResolvedValue([]);
  });

  describe('list', () => {
    it('should return appointments and set search_path', async () => {
      const items = [{ id: 'a1', status: 'PENDENTE' }];
      mockQb.getMany.mockResolvedValue(items);

      const result = await service.list(TENANT_ID, {});

      expect(result).toEqual(items);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path'),
      );
    });

    it('should apply dateStart filter when provided', async () => {
      mockQb.getMany.mockResolvedValue([]);

      await service.list(TENANT_ID, { dateStart: '2026-03-17T00:00:00Z' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('dateStart'),
        expect.any(Object),
      );
    });
  });

  describe('getById', () => {
    it('should return appointment when found', async () => {
      const item = { id: 'a1', status: 'PENDENTE' };
      mockRepo.findOne.mockResolvedValue(item);

      const result = await service.getById(TENANT_ID, 'a1');

      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create appointment and return data with conflicts', async () => {
      const dto = {
        clienteId: '00000000-0000-0000-0000-000000000002',
        veiculoId: '00000000-0000-0000-0000-000000000003',
        dataHora: '2026-03-17T09:00:00Z',
        duracaoMin: 60,
      };
      const created = { id: 'a1', ...dto };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);
      mockQueryRunner.query.mockResolvedValueOnce(undefined) // SET search_path
        .mockResolvedValueOnce([]); // conflicts query

      const result = await service.create(TENANT_ID, dto as any);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('conflicts');
      expect(result.conflicts).toEqual([]);
    });

    it('should return conflicts when overlapping appointment exists', async () => {
      const dto = {
        clienteId: '00000000-0000-0000-0000-000000000002',
        veiculoId: '00000000-0000-0000-0000-000000000003',
        dataHora: '2026-03-17T09:00:00Z',
        duracaoMin: 60,
      };
      const conflict = { id: 'a2', data_hora: '2026-03-17T09:30:00Z', tipo_servico: 'Troca de óleo' };
      const created = { id: 'a1' };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)   // SET search_path
        .mockResolvedValueOnce([conflict]); // conflicts query

      const result = await service.create(TENANT_ID, dto as any);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].id).toBe('a2');
    });
  });

  describe('update', () => {
    it('should update appointment and return data with conflicts', async () => {
      const item = { id: 'a1', status: 'PENDENTE', dataHora: new Date('2026-03-17T09:00:00Z'), duracaoMin: 60 };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'CONFIRMADO' });

      const result = await service.update(TENANT_ID, 'a1', { status: 'CONFIRMADO' } as any);

      expect(result.data.status).toBe('CONFIRMADO');
      expect(result).toHaveProperty('conflicts');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update(TENANT_ID, 'nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete appointment when found', async () => {
      const item = { id: 'a1' };
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.delete(TENANT_ID, 'a1');

      expect(mockRepo.remove).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
