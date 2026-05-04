import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminSegmentsService } from './admin-segments.service';
import { TenantEntity } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';

describe('AdminSegmentsService', () => {
  let service: AdminSegmentsService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      count: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        AdminSegmentsService,
        { provide: getRepositoryToken(TenantEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminSegmentsService);
  });

  it('agrupa por segmento e status', async () => {
    repo.count.mockResolvedValue(130);
    repo.getRawMany
      .mockResolvedValueOnce([
        { segment: 'WORKSHOP', status: 'ACTIVE', count: '50' },
        { segment: 'WORKSHOP', status: 'TRIAL', count: '10' },
        { segment: 'RECYCLING', status: 'ACTIVE', count: '40' },
      ])
      .mockResolvedValueOnce([
        { segment: 'WORKSHOP', count: '20' },
        { segment: 'RECYCLING', count: '15' },
      ])
      .mockResolvedValueOnce([
        { segment: 'WORKSHOP', count: '5' },
        { segment: 'RECYCLING', count: '3' },
      ]);
    const out = await service.list();
    expect(out.totalTenants).toBe(130);
    const wp = out.segments.find((s) => s.segment === TenantSegment.WORKSHOP)!;
    expect(wp.total).toBe(60);
    expect(wp.byStatus.ACTIVE).toBe(50);
    expect(wp.whatsappCount).toBe(20);
    expect(wp.newLast30Days).toBe(5);
    expect(wp.mrr).toBeNull();
  });
});
