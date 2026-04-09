import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { StockService } from './stock.service';

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('StockService', () => {
  let service: StockService;
  const TENANT = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<StockService>(StockService);
    jest.clearAllMocks();
  });

  describe('getSchemaName security', () => {
    it('should throw on invalid tenantId', async () => {
      await expect(service.getBalances('../../evil')).rejects.toThrow('Invalid tenantId');
    });
  });

  describe('getBalances', () => {
    it('should return stock balance per product using SUM of movements', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET LOCAL search_path
        .mockResolvedValueOnce([
          { product_id: 'p1', product_name: 'Papelão', unit_abbreviation: 'kg', balance: '150.0000' },
          { product_id: 'p2', product_name: 'Latinha', unit_abbreviation: 'kg', balance: '30.0000' },
        ]);

      const result = await service.getBalances(TENANT);
      expect(result).toHaveLength(2);
      expect(result[0].balance).toBe(150);
      expect(result[0].productName).toBe('Papelão');
    });

    it('should return empty array when no products', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);

      const result = await service.getBalances(TENANT);
      expect(result).toHaveLength(0);
    });
  });

  describe('getMovements', () => {
    it('should return movements for a specific product ordered by date desc', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET LOCAL search_path
        .mockResolvedValueOnce([
          { id: 'm1', type: 'IN', quantity: '100.0000', reference_type: 'PURCHASE', moved_at: '2026-04-07T10:00:00Z' },
        ]);

      const result = await service.getMovements(TENANT, 'p1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('IN');
      expect(result[0].quantity).toBe(100);
    });
  });

  describe('getDailyPurchaseTotals', () => {
    it('should return purchase totals per product for a given date', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // SET LOCAL search_path
        .mockResolvedValueOnce([
          { product_id: 'p1', product_name: 'Papelão', unit_abbreviation: 'kg', total_quantity: '50.0000' },
        ]);

      const result = await service.getDailyPurchaseTotals(TENANT, '2026-04-07');
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(50);
    });
  });
});
