import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RecyclingReportsService } from './reports.service';

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('RecyclingReportsService', () => {
  let service: RecyclingReportsService;
  const TENANT = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecyclingReportsService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<RecyclingReportsService>(RecyclingReportsService);
    jest.clearAllMocks();
  });

  it('should throw on invalid tenantId', async () => {
    await expect(service.getDashboardSummary('bad-id')).rejects.toThrow('Invalid tenantId');
  });

  describe('getDashboardSummary', () => {
    it('should return today totals and cash session info', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('purchases') && sql.includes('CURRENT_DATE')) return [{ total_today: '1500.00', purchases_count: '5' }];
        if (sql.includes('cash_sessions')) return [{ status: 'OPEN', opening_balance: '200.00' }];
        return [];
      });

      const result = await service.getDashboardSummary(TENANT);
      expect(result.totalPurchasedToday).toBe(1500);
      expect(result.purchasesCountToday).toBe(5);
      expect(result.cashSession).toBeDefined();
      expect(result.cashSession?.openingBalance).toBe(200);
    });

    it('should return null cashSession when no open session', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('purchases') && sql.includes('CURRENT_DATE')) return [{ total_today: '0.00', purchases_count: '0' }];
        if (sql.includes('cash_sessions')) return [];
        return [];
      });

      const result = await service.getDashboardSummary(TENANT);
      expect(result.cashSession).toBeNull();
    });
  });

  describe('getPurchasesByPeriod', () => {
    it('should return purchase totals grouped by day', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        return [{ date: '2026-04-07', total: '1500.00', count: '3' }];
      });

      const result = await service.getPurchasesByPeriod(TENANT, '2026-04-01', '2026-04-07');
      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(1500);
      expect(result[0].count).toBe(3);
    });
  });
});
