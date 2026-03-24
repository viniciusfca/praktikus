import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VehiclesService } from './vehicles.service';
import { VehicleEntity } from './vehicle.entity';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockVehicleRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn().mockReturnValue(mockVehicleRepo),
    query: jest.fn(),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('VehiclesService', () => {
  let service: VehiclesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation(() => mockVehicleRepo);
    mockQueryRunner.manager.query.mockReset();
    mockVehicleRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
  });

  describe('list', () => {
    it('should return paginated vehicles', async () => {
      const vehicles = [{ id: 'v1', placa: 'ABC1234' }];
      mockQb.getManyAndCount.mockResolvedValue([vehicles, 1]);

      const result = await service.list('00000000-0000-0000-0000-000000000001', 1, 20);

      expect(result).toEqual({ data: vehicles, total: 1, page: 1, limit: 20 });
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path'),
      );
    });

    it('should apply search filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list('00000000-0000-0000-0000-000000000001', 1, 20, 'ford');

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.any(Object),
      );
    });
  });

  describe('getById', () => {
    it('should return vehicle when found', async () => {
      const vehicle = { id: 'v1', placa: 'ABC1234' };
      mockVehicleRepo.findOne.mockResolvedValue(vehicle);

      const result = await service.getById('00000000-0000-0000-0000-000000000001', 'v1');

      expect(result).toEqual(vehicle);
    });

    it('should throw NotFoundException when vehicle not found', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('00000000-0000-0000-0000-000000000001', 'v1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and return vehicle', async () => {
      const dto = { customerId: 'c1', placa: 'ABC1234', marca: 'Ford', modelo: 'Ka', ano: 2020, km: 0 };
      const created = { id: 'v1', ...dto };
      mockVehicleRepo.create.mockReturnValue(created);
      mockVehicleRepo.save.mockResolvedValue(created);

      const result = await service.create('00000000-0000-0000-0000-000000000001', dto as any);

      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('should update and return vehicle', async () => {
      const vehicle = { id: 'v1', placa: 'ABC1234', marca: 'Ford' };
      mockVehicleRepo.findOne.mockResolvedValue(vehicle);
      mockVehicleRepo.save.mockResolvedValue({ ...vehicle, marca: 'Toyota' });

      const result = await service.update('00000000-0000-0000-0000-000000000001', 'v1', { marca: 'Toyota' } as any);

      expect(mockVehicleRepo.save).toHaveBeenCalled();
      expect(result.marca).toBe('Toyota');
    });

    it('should throw NotFoundException when vehicle not found', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(null);

      await expect(service.update('00000000-0000-0000-0000-000000000001', 'nonexistent', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete vehicle when found', async () => {
      const vehicle = { id: 'v1' };
      mockVehicleRepo.findOne.mockResolvedValue(vehicle);
      mockVehicleRepo.remove.mockResolvedValue(undefined);

      await service.delete('00000000-0000-0000-0000-000000000001', 'v1');

      expect(mockVehicleRepo.remove).toHaveBeenCalledWith(vehicle);
    });

    it('should throw NotFoundException when vehicle not found', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('00000000-0000-0000-0000-000000000001', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getServiceOrders', () => {
    const TENANT = '00000000-0000-0000-0000-000000000001';
    const VEHICLE_ID = '00000000-0000-0000-0000-000000000002';

    beforeEach(() => {
      mockQueryRunner.manager.query.mockReset();
    });

    it('should return empty array when vehicle has no service orders', async () => {
      mockVehicleRepo.findOne.mockResolvedValueOnce({ id: VEHICLE_ID });
      mockQueryRunner.manager.query.mockResolvedValueOnce([]);

      const result = await service.getServiceOrders(TENANT, VEHICLE_ID);

      expect(result).toEqual([]);
      expect(mockQueryRunner.manager.query).toHaveBeenCalledTimes(1);
    });

    it('should return orders with items and computed total', async () => {
      const orders = [
        {
          id: 'so1',
          status: 'ENTREGUE',
          statusPagamento: 'PAGO',
          kmEntrada: '45000',
          combustivel: 'cheio',
          observacoesEntrada: null,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const services = [
        { soId: 'so1', id: 'si1', nomeServico: 'Troca de óleo', valor: '150.00', mecanicoId: null },
      ];
      const parts = [
        { soId: 'so1', id: 'pi1', nomePeca: 'Filtro', quantidade: 1, valorUnitario: '50.00' },
      ];

      mockVehicleRepo.findOne.mockResolvedValueOnce({ id: VEHICLE_ID });
      mockQueryRunner.manager.query
        .mockResolvedValueOnce(orders)
        .mockResolvedValueOnce(services)
        .mockResolvedValueOnce(parts);

      const result = await service.getServiceOrders(TENANT, VEHICLE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(200);
      expect(result[0].itemsServices).toHaveLength(1);
      expect(result[0].itemsParts).toHaveLength(1);
      expect(mockQueryRunner.manager.query).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundException when vehicle does not exist', async () => {
      mockVehicleRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getServiceOrders(TENANT, VEHICLE_ID)).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.manager.query).not.toHaveBeenCalled();
    });
  });
});
