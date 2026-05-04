import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminTenantsService } from './admin-tenants.service';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';

describe('AdminTenantsService', () => {
  let service: AdminTenantsService;
  let qb: any;
  let repo: any;

  beforeEach(async () => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      count: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        AdminTenantsService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminTenantsService);
  });

  it('aplica filtros combinatórios + paginação', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    repo.count.mockResolvedValue(0);
    await service.list({
      status: TenantStatus.ACTIVE,
      segment: TenantSegment.WORKSHOP,
      wpp: 'yes',
      q: 'oficina',
      page: 2,
      pageSize: 25,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.status = :status', {
      status: TenantStatus.ACTIVE,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.segment = :segment', {
      segment: TenantSegment.WORKSHOP,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.whatsapp_enabled = :wpp', {
      wpp: true,
    });
    expect(qb.skip).toHaveBeenCalledWith(25);
    expect(qb.take).toHaveBeenCalledWith(25);
  });

  it('mapeia tenants sem endereco para city/state null', async () => {
    qb.getManyAndCount.mockResolvedValue([
      [
        {
          id: 't1',
          nomeFantasia: 'A',
          razaoSocial: 'A LTDA',
          cnpj: '00.000.000/0001-00',
          segment: TenantSegment.WORKSHOP,
          status: TenantStatus.ACTIVE,
          endereco: null,
          whatsappEnabled: false,
          whatsappPlan: null,
          trialEndsAt: null,
          createdAt: new Date('2026-01-01'),
        },
      ],
      1,
    ]);
    repo.count.mockResolvedValue(0);
    const out = await service.list({});
    expect(out.data[0].city).toBeNull();
    expect(out.data[0].state).toBeNull();
    expect(out.data[0].mrr).toBeNull();
    expect(out.data[0].healthScore).toBeNull();
  });

  it('computa trialDaysLeft quando trialEndsAt está no futuro', async () => {
    const future = new Date(Date.now() + 5 * 86_400_000);
    qb.getManyAndCount.mockResolvedValue([
      [
        {
          id: 't1',
          nomeFantasia: 'A',
          razaoSocial: 'A',
          cnpj: 'x',
          segment: TenantSegment.WORKSHOP,
          status: TenantStatus.TRIAL,
          endereco: { city: 'SP', state: 'SP' },
          whatsappEnabled: false,
          whatsappPlan: null,
          trialEndsAt: future,
          createdAt: new Date(),
        },
      ],
      1,
    ]);
    repo.count.mockResolvedValue(0);
    const out = await service.list({});
    expect(out.data[0].trialDaysLeft).toBeGreaterThanOrEqual(4);
    expect(out.data[0].trialDaysLeft).toBeLessThanOrEqual(5);
  });

  it('retorna countersByStatus para todos os status', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    repo.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    const out = await service.list({});
    expect(out.countersByStatus.ACTIVE).toBe(10);
    expect(out.countersByStatus.TRIAL).toBe(5);
    expect(out.countersByStatus.OVERDUE).toBe(2);
    expect(out.countersByStatus.SUSPENDED).toBe(1);
  });
});
