import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RecyclingReportsService } from './reports.service';

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('RecyclingReportsService', () => {
  let service: RecyclingReportsService;
  const TENANT = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecyclingReportsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<RecyclingReportsService>(RecyclingReportsService);
    jest.clearAllMocks();
  });

  it('should throw on invalid tenantId (getDashboardSummary)', async () => {
    await expect(service.getDashboardSummary('bad-id')).rejects.toThrow(
      'Invalid tenantId',
    );
  });

  it('should throw on invalid tenantId (getPurchasesByPeriod)', async () => {
    await expect(
      service.getPurchasesByPeriod('bad-id', '2026-04-01', '2026-04-30'),
    ).rejects.toThrow('Invalid tenantId');
  });

  describe('getDashboardSummary', () => {
    it('should return today totals, monthly total and cash session info with current balance', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('CURRENT_DATE') && sql.includes('total_today')) {
          return [{ total_today: '1500.00', purchases_count: '5' }];
        }
        if (sql.includes("date_trunc('month'") && sql.includes('total_month')) {
          return [{ total_month: '14820.00', purchases_count_month: '42' }];
        }
        if (sql.includes('cash_sessions'))
          return [{ id: 'sess1', status: 'OPEN', opening_balance: '200.00' }];
        if (sql.includes('cash_transactions'))
          return [{ total_in: '800.00', total_out: '340.00' }];
        return [];
      });

      const result = await service.getDashboardSummary(TENANT);
      expect(result.totalPurchasedToday).toBe(1500);
      expect(result.purchasesCountToday).toBe(5);
      expect(result.totalPurchasedMonth).toBe(14820);
      expect(result.purchasesCountMonth).toBe(42);
      expect(result.cashSession?.openingBalance).toBe(200);
      expect(result.cashSession?.currentBalance).toBe(660);
    });

    it('should return null cashSession when no open session', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('CURRENT_DATE') && sql.includes('total_today')) {
          return [{ total_today: '0.00', purchases_count: '0' }];
        }
        if (sql.includes("date_trunc('month'") && sql.includes('total_month')) {
          return [{ total_month: '0.00', purchases_count_month: '0' }];
        }
        if (sql.includes('cash_sessions')) return [];
        return [];
      });

      const result = await service.getDashboardSummary(TENANT);
      expect(result.cashSession).toBeNull();
      expect(result.totalPurchasedMonth).toBe(0);
    });
  });

  describe('getPurchasesByPeriod', () => {
    it('should return purchase totals grouped by day', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        return [{ date: '2026-04-07', total: '1500.00', count: '3' }];
      });

      const result = await service.getPurchasesByPeriod(
        TENANT,
        '2026-04-01',
        '2026-04-07',
      );
      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(1500);
      expect(result[0].count).toBe(3);
    });
  });

  describe('getSalesSummary', () => {
    it('should throw on invalid tenantId', async () => {
      await expect(service.getSalesSummary('bad-id')).rejects.toThrow(
        'Invalid tenantId',
      );
    });

    it('should return totals for today, week and month', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('DATE(s.sold_at) = CURRENT_DATE')) {
          return [{ total: '680.00', count: '1' }];
        }
        if (sql.includes("CURRENT_DATE - interval '7 days'")) {
          return [{ total: '1690.00', count: '4' }];
        }
        if (sql.includes("date_trunc('month'")) {
          return [{ total: '22540.00', count: '52' }];
        }
        return [];
      });

      const result = await service.getSalesSummary(TENANT);
      expect(result.today).toEqual({ total: 680, count: 1 });
      expect(result.week).toEqual({ total: 1690, count: 4 });
      expect(result.month).toEqual({ total: 22540, count: 52 });
    });

    it('should return zeros when no sales', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        return [{ total: '0.00', count: '0' }];
      });

      const result = await service.getSalesSummary(TENANT);
      expect(result.today).toEqual({ total: 0, count: 0 });
      expect(result.week).toEqual({ total: 0, count: 0 });
      expect(result.month).toEqual({ total: 0, count: 0 });
    });
  });

  describe('getPurchasesSummary', () => {
    it('should throw on invalid tenantId', async () => {
      await expect(service.getPurchasesSummary('bad-id')).rejects.toThrow(
        'Invalid tenantId',
      );
    });

    it('should return totals for today, week and month', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('DATE(purchased_at) = CURRENT_DATE')) {
          return [{ total: '1500.00', count: '5' }];
        }
        if (sql.includes("CURRENT_DATE - interval '7 days'")) {
          return [{ total: '7200.00', count: '18' }];
        }
        if (sql.includes("date_trunc('month'")) {
          return [{ total: '14820.00', count: '42' }];
        }
        return [];
      });

      const result = await service.getPurchasesSummary(TENANT);
      expect(result.today).toEqual({ total: 1500, count: 5 });
      expect(result.week).toEqual({ total: 7200, count: 18 });
      expect(result.month).toEqual({ total: 14820, count: 42 });
    });

    it('should return zeros when no purchases', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        return [{ total: '0.00', count: '0' }];
      });

      const result = await service.getPurchasesSummary(TENANT);
      expect(result.today).toEqual({ total: 0, count: 0 });
      expect(result.week).toEqual({ total: 0, count: 0 });
      expect(result.month).toEqual({ total: 0, count: 0 });
    });
  });

  describe('getSalesByPeriod', () => {
    it('should throw on invalid tenantId', async () => {
      await expect(
        service.getSalesByPeriod('bad-id', '2026-04-01', '2026-04-30'),
      ).rejects.toThrow('Invalid tenantId');
    });

    it('should return sale totals grouped by day with date as text', async () => {
      const queries: string[] = [];
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('SET LOCAL')) return undefined;
        return [{ date: '2026-04-07', total: '320.00', count: '2' }];
      });

      const result = await service.getSalesByPeriod(
        TENANT,
        '2026-04-01',
        '2026-04-07',
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ date: '2026-04-07', total: 320, count: 2 });
      // Ensure the date is cast to ::text so frontend doesn't get raw Date
      const dataQuery = queries.find((q) => q.includes('sale_items'));
      expect(dataQuery).toMatch(/DATE\(s\.sold_at\)::text/);
    });
  });

  describe('getDashboardStats', () => {
    it('should throw on invalid tenantId', async () => {
      await expect(service.getDashboardStats('bad-id')).rejects.toThrow(
        'Invalid tenantId',
      );
    });

    it('should return sales today, stock total kg and upcoming coletas', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('sale_items') && sql.includes('CURRENT_DATE')) {
          return [{ total: '24.00' }];
        }
        if (sql.includes('stock_movements')) {
          return [{ total: '30.5' }];
        }
        if (sql.includes('coletas') && sql.includes('AGENDADA')) {
          return [
            {
              id: 'col1',
              scheduled_at: new Date('2026-05-12T13:00:00.000Z'),
              status: 'AGENDADA',
              supplier_id: 'sup1',
              supplier_name: 'EcoMaterial',
              notes: null,
            },
          ];
        }
        return [];
      });

      const result = await service.getDashboardStats(TENANT);
      expect(result.salesToday).toBe(24);
      expect(result.stockTotalKg).toBe(30.5);
      expect(result.upcomingColetas).toHaveLength(1);
      expect(result.upcomingColetas[0]).toMatchObject({
        id: 'col1',
        supplierId: 'sup1',
        supplierName: 'EcoMaterial',
        status: 'AGENDADA',
      });
      expect(result.upcomingColetas[0].scheduledAt).toMatch(/^2026-05-12T/);
    });

    it('should return zeros and empty list when no data', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes('coletas')) return [];
        return [{ total: '0' }];
      });

      const result = await service.getDashboardStats(TENANT);
      expect(result.salesToday).toBe(0);
      expect(result.stockTotalKg).toBe(0);
      expect(result.upcomingColetas).toEqual([]);
    });
  });

  describe('getTopMaterialsRanking', () => {
    it('should throw on invalid tenantId', async () => {
      await expect(service.getTopMaterialsRanking('bad-id')).rejects.toThrow(
        'Invalid tenantId',
      );
    });

    it('should return materials ranked by total quantity', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        return [
          {
            product_id: 'p1',
            product_name: 'Alumínio',
            total_qty: '820.5',
            total_value: '6970.25',
            purchase_count: '12',
          },
          {
            product_id: 'p2',
            product_name: 'PET',
            total_qty: '640.0',
            total_value: '1408.00',
            purchase_count: '8',
          },
        ];
      });

      const result = await service.getTopMaterialsRanking(TENANT, '2026-05', 10);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        productId: 'p1',
        productName: 'Alumínio',
        totalQty: 820.5,
        totalValue: 6970.25,
        purchaseCount: 12,
      });
      expect(result[1].productName).toBe('PET');
    });

    it('should default month to current and clamp limit', async () => {
      const queries: string[] = [];
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('SET LOCAL')) return undefined;
        return [];
      });

      await service.getTopMaterialsRanking(TENANT, undefined, 100);
      const dataQuery = queries.find((q) => q.includes('purchase_items'));
      expect(dataQuery).toBeDefined();
      expect(dataQuery).toContain("date_trunc('month', CURRENT_DATE)");
      // Limit clamped to 50
      expect(dataQuery).toContain('LIMIT 50');
    });
  });

  describe('getTopMaterials', () => {
    it('should throw on invalid tenantId', async () => {
      await expect(service.getTopMaterials('bad-id')).rejects.toThrow(
        'Invalid tenantId',
      );
    });

    it('should return top materials for current month with change vs previous', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        if (sql.includes("date_trunc('month', CURRENT_DATE) - interval")) {
          return [{ product_id: 'p1', volume_kg: '720.0000' }];
        }
        if (sql.includes("date_trunc('month', CURRENT_DATE)")) {
          return [
            {
              product_id: 'p1',
              name: 'Alumínio',
              volume_kg: '820.0000',
              avg_price: '8.5000',
            },
            {
              product_id: 'p2',
              name: 'PET',
              volume_kg: '640.0000',
              avg_price: '2.2000',
            },
          ];
        }
        return [];
      });

      const result = await service.getTopMaterials(TENANT);
      expect(result).toHaveLength(2);
      expect(result[0].productId).toBe('p1');
      expect(result[0].volumeKg).toBe(820);
      expect(result[0].avgPricePerKg).toBe(8.5);
      expect(result[0].changePct).toBeCloseTo(13.9, 1);
      expect(result[1].changePct).toBeNull();
    });

    it('should accept explicit month parameter', async () => {
      const queries: string[] = [];
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('SET LOCAL')) return undefined;
        return [];
      });

      await service.getTopMaterials(TENANT, '2026-03', 10);
      const monthQuery = queries.find((q) => q.includes("'2026-03-01'"));
      expect(monthQuery).toBeDefined();
      expect(queries.some((q) => q.includes('LIMIT 10'))).toBe(true);
    });

    it('should return empty array when no purchases in month', async () => {
      mockQueryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SET LOCAL')) return undefined;
        return [];
      });

      const result = await service.getTopMaterials(TENANT);
      expect(result).toEqual([]);
    });
  });
});
