import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { TenantSegment, WhatsappPlan } from '@praktikus/shared';
import {
  WhatsappAdoptionTenant,
  WhatsappResponseDto,
} from './dto/whatsapp-response.dto';

@Injectable()
export class AdminWhatsappService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async list(): Promise<WhatsappResponseDto> {
    const eligibleStatuses = [TenantStatus.ACTIVE, TenantStatus.TRIAL];

    const [eligibleCount, usingCount, starterCount, proCount, enterpriseCount] =
      await Promise.all([
        this.repo.count({ where: { status: In(eligibleStatuses) } }),
        this.repo.count({ where: { whatsappEnabled: true } }),
        this.repo.count({
          where: { whatsappPlan: WhatsappPlan.STARTER } as any,
        }),
        this.repo.count({ where: { whatsappPlan: WhatsappPlan.PRO } as any }),
        this.repo.count({
          where: { whatsappPlan: WhatsappPlan.ENTERPRISE } as any,
        }),
      ]);

    type SegmentRow = { segment: string; using: string; eligible: string };

    const [using, notUsing, segmentRows]: [
      TenantEntity[],
      TenantEntity[],
      SegmentRow[],
    ] = await Promise.all([
      this.repo.find({
        where: { whatsappEnabled: true },
        order: { updatedAt: 'DESC' },
        take: 100,
      }),
      this.repo.find({
        where: {
          whatsappEnabled: false,
          status: In(eligibleStatuses),
        },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
      this.repo
        .createQueryBuilder('t')
        .select('t.segment', 'segment')
        .addSelect(
          `SUM(CASE WHEN t.whatsapp_enabled THEN 1 ELSE 0 END)`,
          'using',
        )
        .addSelect('COUNT(*)', 'eligible')
        .where('t.status IN (:...statuses)', { statuses: eligibleStatuses })
        .groupBy('t.segment')
        .getRawMany(),
    ]);

    return {
      kpis: {
        adoptionRate: eligibleCount > 0 ? usingCount / eligibleCount : 0,
        starterCount,
        proCount,
        enterpriseCount,
        addOnMrr: null,
      },
      using: using.map((t) => this.toItem(t)),
      notUsing: notUsing.map((t) => this.toItem(t)),
      adoptionBySegment: segmentRows.map((r) => {
        const elig = Number(r.eligible);
        const use = Number(r.using);
        return {
          segment: r.segment as TenantSegment,
          rate: elig > 0 ? use / elig : 0,
          using: use,
          eligible: elig,
        };
      }),
    };
  }

  private toItem(t: TenantEntity): WhatsappAdoptionTenant {
    return {
      id: t.id,
      nomeFantasia: t.nomeFantasia,
      segment: t.segment,
      status: t.status,
      whatsappPlan: t.whatsappPlan ?? null,
      enabledAt: t.whatsappEnabled ? t.updatedAt.toISOString() : null,
      monthlyVolume: null,
    };
  }
}
