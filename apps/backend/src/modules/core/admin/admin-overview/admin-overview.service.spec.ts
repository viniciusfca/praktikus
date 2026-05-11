import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminOverviewService } from './admin-overview.service';
import { TenantEntity } from '../../tenancy/tenant.entity';

describe('AdminOverviewService', () => {
  let service: AdminOverviewService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      count: jest.fn(),
      find: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        AdminOverviewService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminOverviewService);
  });

  it('agrega KPIs, distribuições e trials expirando', async () => {
    repo.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(48);
    repo.getRawMany
      .mockResolvedValueOnce([
        { status: 'ACTIVE', count: '120' },
        { status: 'TRIAL', count: '30' },
        { status: 'OVERDUE', count: '5' },
        { status: 'SUSPENDED', count: '2' },
      ])
      .mockResolvedValueOnce([
        { segment: 'WORKSHOP', count: '90' },
        { segment: 'RECYCLING', count: '40' },
      ])
      .mockResolvedValueOnce([
        { uf: 'SP', count: '40' },
        { uf: 'RJ', count: '15' },
      ])
      .mockResolvedValueOnce([
        { month: '2026-04', count: '8' },
        { month: '2026-05', count: '12' },
      ]);
    repo.find.mockResolvedValue([
      {
        id: 't1',
        nomeFantasia: 'Oficina ABC',
        segment: 'WORKSHOP',
        trialEndsAt: new Date(Date.now() + 3 * 86_400_000),
      },
    ]);

    const out = await service.getOverview();
    expect(out.kpis.activeTenants.value).toBe(120);
    expect(out.kpis.trialTenants.value).toBe(30);
    expect(out.kpis.whatsappTenants.value).toBe(48);
    expect(out.kpis.mrr.value).toBeNull();
    expect(out.statusDistribution).toHaveLength(4);
    expect(out.segmentDistribution).toHaveLength(2);
    expect(out.ufDistribution[0]).toEqual({ uf: 'SP', count: 40 });
    expect(out.trialsExpiring).toHaveLength(1);
    expect(out.trialsExpiring[0].daysLeft).toBeGreaterThanOrEqual(2);
    expect(out.trialsExpiring[0].daysLeft).toBeLessThanOrEqual(3);
  });

  it('lista de trials vazia quando não há expirando', async () => {
    repo.count.mockResolvedValue(0);
    repo.getRawMany.mockResolvedValue([]);
    repo.find.mockResolvedValue([]);
    const out = await service.getOverview();
    expect(out.trialsExpiring).toEqual([]);
  });
});
