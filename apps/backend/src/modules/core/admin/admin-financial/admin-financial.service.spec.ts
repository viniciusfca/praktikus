import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminFinancialService } from './admin-financial.service';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';

describe('AdminFinancialService', () => {
  let service: AdminFinancialService;
  let repo: any;

  beforeEach(async () => {
    repo = { count: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AdminFinancialService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminFinancialService);
  });

  it('retorna KPIs Asaas como null e counts reais', async () => {
    repo.count
      .mockResolvedValueOnce(80) // ACTIVE
      .mockResolvedValueOnce(5) // OVERDUE
      .mockResolvedValueOnce(3) // SUSPENDED total
      .mockResolvedValueOnce(1); // SUSPENDED last 30d
    const out = await service.get();
    expect(out.kpis.mrr).toBeNull();
    expect(out.kpis.arr).toBeNull();
    expect(out.kpis.averageTicket).toBeNull();
    expect(out.kpis.churn30d).toBeNull();
    expect(out.basicDistribution.active).toBe(80);
    expect(out.basicDistribution.overdue).toBe(5);
    expect(out.basicDistribution.suspended).toBe(3);
    expect(out.basicDistribution.suspendedLast30Days).toBe(1);
    expect(out.recentCharges).toEqual([]);
  });
});
