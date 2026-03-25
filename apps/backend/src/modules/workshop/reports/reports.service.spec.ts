import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

const TENANT = '00000000-0000-0000-0000-000000000001';

const mockManager = { query: jest.fn() };
const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: mockManager,
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
    mockQueryRunner.query.mockResolvedValue(undefined);
  });

  describe('getReport', () => {
    it('should throw BadRequestException when dateStart > dateEnd', async () => {
      await expect(
        service.getReport(TENANT, '2026-03-31', '2026-03-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return aggregated report data for a valid period', async () => {
      const kpiRows = [{ totalOs: '5', osPagas: '3' }];
      const servicosRows = [{ faturamentoServicos: '1500.00' }];
      const pecasRows = [{ faturamentoPecas: '500.00' }];
      const statusRows = [
        { status: 'ENTREGUE', count: '3' },
        { status: 'FINALIZADA', count: '2' },
      ];
      const mesRows = [
        { mes: '2026-03', servicos: '1500.00', pecas: '500.00', total: '2000.00' },
      ];
      const topRows = [
        { nomeServico: 'Troca de óleo', quantidade: '3', receita: '450.00' },
      ];

      mockManager.query
        .mockResolvedValueOnce(kpiRows)
        .mockResolvedValueOnce(servicosRows)
        .mockResolvedValueOnce(pecasRows)
        .mockResolvedValueOnce(statusRows)
        .mockResolvedValueOnce(mesRows)
        .mockResolvedValueOnce(topRows);

      const result = await service.getReport(TENANT, '2026-03-01', '2026-03-31');

      expect(result.totalOs).toBe(5);
      expect(result.osPagas).toBe(3);
      expect(result.faturamentoServicos).toBe(1500);
      expect(result.faturamentoPecas).toBe(500);
      expect(result.faturamentoTotal).toBe(2000);
      expect(result.osPorStatus).toHaveLength(2);
      expect(result.osPorStatus[0]).toEqual({ status: 'ENTREGUE', count: 3 });
      expect(result.faturamentoPorMes).toHaveLength(1);
      expect(result.faturamentoPorMes[0]).toEqual({
        mes: '2026-03',
        servicos: 1500,
        pecas: 500,
        total: 2000,
      });
      expect(result.topServicos).toHaveLength(1);
      expect(result.topServicos[0]).toEqual({
        nomeServico: 'Troca de óleo',
        quantidade: 3,
        receita: 450,
      });
      expect(mockManager.query).toHaveBeenCalledTimes(6);
    });

    it('should return zeros when no OS in the period', async () => {
      mockManager.query
        .mockResolvedValueOnce([{ totalOs: '0', osPagas: '0' }])
        .mockResolvedValueOnce([{ faturamentoServicos: null }])
        .mockResolvedValueOnce([{ faturamentoPecas: null }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getReport(TENANT, '2026-01-01', '2026-01-31');

      expect(result.totalOs).toBe(0);
      expect(result.faturamentoTotal).toBe(0);
      expect(result.osPorStatus).toEqual([]);
      expect(result.faturamentoPorMes).toEqual([]);
      expect(result.topServicos).toEqual([]);
    });
  });
});
