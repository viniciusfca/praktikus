import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SalesService } from './sales.service';
import { SaleEntity } from './sale.entity';
import { SaleItemEntity } from './sale-item.entity';
import { StockMovementEntity } from '../purchases/stock-movement.entity';

const mockSaleRepo = { create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
const mockItemRepo = { create: jest.fn(), save: jest.fn() };
const mockMovementRepo = { create: jest.fn(), save: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === SaleEntity) return mockSaleRepo;
      if (entity === SaleItemEntity) return mockItemRepo;
      return mockMovementRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

const TENANT = '00000000-0000-0000-0000-000000000001';
const OPERATOR = '00000000-0000-0000-0000-000000000002';

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SalesService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<SalesService>(SalesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === SaleEntity) return mockSaleRepo;
      if (entity === SaleItemEntity) return mockItemRepo;
      return mockMovementRepo;
    });
  });

  it('should throw on invalid tenantId', async () => {
    await expect(service.create('bad-id', OPERATOR, { buyerId: 'b1', items: [{ productId: 'p1', quantity: 1, unitPrice: 1 }] }))
      .rejects.toThrow('Invalid tenantId');
  });

  describe('list', () => {
    it('should return enriched sales with buyer name, total and material summary', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('COUNT(*) as count')) return [{ count: '1' }];
        if (sql.includes('FROM "tenant_')) {
          return [
            {
              id: 'sale1',
              sold_at: new Date('2026-04-18T10:42:00Z'),
              buyer_id: 'buyer1',
              notes: null,
              buyer_name: 'MGLU Recicla',
              total: '680.00',
              item_count: '1',
              total_kg: '80.0000',
              first_product_name: 'Alumínio',
            },
          ];
        }
        return [];
      });

      const result = await service.list(TENANT, 1, 20);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'sale1',
        buyerId: 'buyer1',
        buyerName: 'MGLU Recicla',
        total: 680,
        itemCount: 1,
        totalKg: 80,
        firstProductName: 'Alumínio',
        notes: null,
      });
    });

    it('should throw on invalid tenantId', async () => {
      await expect(service.list('bad-id', 1, 20)).rejects.toThrow('Invalid tenantId');
    });
  });

  describe('create', () => {
    it('should throw BadRequestException when stock is insufficient', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('stock_movements')) return [{ balance: '5.0000' }];
        return undefined;
      });

      await expect(
        service.create(TENANT, OPERATOR, {
          buyerId: 'b1',
          items: [{ productId: 'p1', quantity: 10, unitPrice: 1.5 }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should create sale with stock OUT movements when stock is sufficient', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('stock_movements')) return [{ balance: '50.0000' }];
        return undefined;
      });

      const sale = { id: 'sale1' };
      mockSaleRepo.create.mockReturnValue(sale);
      mockSaleRepo.save.mockResolvedValue(sale);
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockReturnValue({});
      mockMovementRepo.save.mockResolvedValue({});

      const result = await service.create(TENANT, OPERATOR, {
        buyerId: 'b1',
        items: [{ productId: 'p1', quantity: 10, unitPrice: 1.5 }],
      });

      expect(mockMovementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'OUT', quantity: 10 })
      );
      // No cash_transaction created
      expect(result).toEqual(sale);
    });

    it('should NOT create any cash_transaction', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('stock_movements')) return [{ balance: '50.0000' }];
        return undefined;
      });

      const sale = { id: 'sale1' };
      mockSaleRepo.create.mockReturnValue(sale);
      mockSaleRepo.save.mockResolvedValue(sale);
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue({});
      mockMovementRepo.create.mockReturnValue({});
      mockMovementRepo.save.mockResolvedValue({});

      await service.create(TENANT, OPERATOR, {
        buyerId: 'b1',
        items: [{ productId: 'p1', quantity: 5, unitPrice: 2 }],
      });

      // CashTransactionEntity repo should never be accessed
      const repoCallArgs = mockQueryRunner.manager.getRepository.mock.calls.map((c: any[]) => c[0]?.name ?? c[0]);
      expect(repoCallArgs).not.toContain('CashTransactionEntity');
    });
  });
});
