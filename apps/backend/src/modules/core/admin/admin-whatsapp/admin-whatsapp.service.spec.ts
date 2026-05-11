import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminWhatsappService } from './admin-whatsapp.service';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';

describe('AdminWhatsappService', () => {
  let service: AdminWhatsappService;
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
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        AdminWhatsappService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminWhatsappService);
  });

  it('calcula adoption rate sobre ACTIVE+TRIAL', async () => {
    repo.count
      .mockResolvedValueOnce(150) // eligible (ACTIVE+TRIAL)
      .mockResolvedValueOnce(60) // using
      .mockResolvedValueOnce(35) // STARTER
      .mockResolvedValueOnce(20) // PRO
      .mockResolvedValueOnce(5); // ENTERPRISE
    repo.find
      .mockResolvedValueOnce([]) // using
      .mockResolvedValueOnce([]); // notUsing
    repo.getRawMany.mockResolvedValueOnce([
      { segment: 'WORKSHOP', using: '40', eligible: '90' },
      { segment: 'RECYCLING', using: '20', eligible: '60' },
    ]);
    const out = await service.list();
    expect(out.kpis.adoptionRate).toBeCloseTo(60 / 150, 3);
    expect(out.kpis.starterCount).toBe(35);
    expect(out.kpis.proCount).toBe(20);
    expect(out.kpis.enterpriseCount).toBe(5);
    expect(out.kpis.addOnMrr).toBeNull();
    expect(out.adoptionBySegment[0].rate).toBeCloseTo(40 / 90, 3);
  });

  it('adoption rate 0 quando não há tenants elegíveis', async () => {
    repo.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    repo.find.mockResolvedValue([]);
    repo.getRawMany.mockResolvedValue([]);
    const out = await service.list();
    expect(out.kpis.adoptionRate).toBe(0);
  });

  it('mapeia tenants para WhatsappAdoptionTenant com enabledAt preenchido', async () => {
    const updatedAt = new Date('2025-01-15T10:00:00.000Z');
    const tenant = {
      id: 'tid-1',
      nomeFantasia: 'Oficina A',
      segment: TenantSegment.WORKSHOP,
      status: TenantStatus.ACTIVE,
      whatsappPlan: 'STARTER',
      whatsappEnabled: true,
      updatedAt,
    } as unknown as TenantEntity;
    repo.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    repo.find.mockResolvedValueOnce([tenant]).mockResolvedValueOnce([]);
    repo.getRawMany.mockResolvedValueOnce([]);
    const out = await service.list();
    expect(out.using[0].enabledAt).toBe(updatedAt.toISOString());
    expect(out.using[0].whatsappPlan).toBe('STARTER');
    expect(out.using[0].monthlyVolume).toBeNull();
  });

  it('mapeia tenant com whatsappEnabled=false para enabledAt=null e whatsappPlan=null', async () => {
    const tenant = {
      id: 'tid-2',
      nomeFantasia: 'Desmanche B',
      segment: TenantSegment.RECYCLING,
      status: TenantStatus.TRIAL,
      whatsappPlan: null,
      whatsappEnabled: false,
      updatedAt: new Date(),
    } as unknown as TenantEntity;
    repo.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    repo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([tenant]);
    repo.getRawMany.mockResolvedValueOnce([]);
    const out = await service.list();
    expect(out.notUsing[0].enabledAt).toBeNull();
    expect(out.notUsing[0].whatsappPlan).toBeNull();
  });

  it('adoptionBySegment rate=0 quando eligible=0', async () => {
    repo.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    repo.find.mockResolvedValue([]);
    repo.getRawMany.mockResolvedValueOnce([
      { segment: 'WORKSHOP', using: '0', eligible: '0' },
    ]);
    const out = await service.list();
    expect(out.adoptionBySegment[0].rate).toBe(0);
  });
});
