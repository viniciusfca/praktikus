import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';
import { OverviewResponseDto } from './dto/overview-response.dto';

@Injectable()
export class AdminOverviewService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
  ) {}

  async getOverview(): Promise<OverviewResponseDto> {
    const [
      activeCount,
      trialCount,
      whatsappCount,
      statusDistribution,
      segmentDistribution,
      ufDistributionRaw,
      sparklineRaw,
      expiringTenants,
    ] = await Promise.all([
      this.tenantRepo.count({ where: { status: TenantStatus.ACTIVE } }),
      this.tenantRepo.count({ where: { status: TenantStatus.TRIAL } }),
      this.tenantRepo.count({ where: { whatsappEnabled: true } }),
      this.statusDistribution(),
      this.segmentDistribution(),
      this.ufDistribution(),
      this.newTenantsLast6Months(),
      this.expiringTrials(),
    ]);

    const sparkline = this.fillMonths(sparklineRaw, 6);

    return {
      kpis: {
        activeTenants: { value: activeCount, deltaVsLastMonth: null, sparkline },
        trialTenants: { value: trialCount, deltaVsLastMonth: null, sparkline },
        whatsappTenants: {
          value: whatsappCount,
          deltaVsLastMonth: null,
          sparkline,
        },
        mrr: { value: null },
      },
      statusDistribution,
      segmentDistribution,
      ufDistribution: ufDistributionRaw,
      trialsExpiring: expiringTenants.map((t) => ({
        tenantId: t.id,
        nomeFantasia: t.nomeFantasia,
        segment: t.segment,
        trialEndsAt: t.trialEndsAt!.toISOString(),
        daysLeft: Math.ceil(
          (t.trialEndsAt!.getTime() - Date.now()) / 86_400_000,
        ),
      })),
    };
  }

  private async statusDistribution() {
    const rows: Array<{ status: string; count: string }> = await this.tenantRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.status')
      .getRawMany();
    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  }

  private async segmentDistribution() {
    const rows: Array<{ segment: string; count: string }> = await this.tenantRepo
      .createQueryBuilder('t')
      .select('t.segment', 'segment')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.segment')
      .getRawMany();
    return rows.map((r) => ({
      segment: r.segment as TenantSegment,
      count: Number(r.count),
    }));
  }

  private async ufDistribution() {
    const rows: Array<{ uf: string | null; count: string }> = await this
      .tenantRepo
      .createQueryBuilder('t')
      .select(`COALESCE(t.endereco->>'state', 'UNKNOWN')`, 'uf')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`COALESCE(t.endereco->>'state', 'UNKNOWN')`)
      .getRawMany();
    return rows
      .map((r) => ({ uf: r.uf ?? 'UNKNOWN', count: Number(r.count) }))
      .sort((a, b) => b.count - a.count);
  }

  private async newTenantsLast6Months() {
    const rows: Array<{ month: string; count: string }> = await this.tenantRepo
      .createQueryBuilder('t')
      .select(`TO_CHAR(t.created_at, 'YYYY-MM')`, 'month')
      .addSelect('COUNT(*)', 'count')
      .where(`t.created_at >= NOW() - INTERVAL '6 months'`)
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();
    return rows.map((r) => ({ month: r.month, count: Number(r.count) }));
  }

  private fillMonths(
    rows: Array<{ month: string; count: number }>,
    n: number,
  ): number[] {
    const out: number[] = [];
    const map = new Map(rows.map((r) => [r.month, r.count]));
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}`;
      out.push(map.get(key) ?? 0);
    }
    return out;
  }

  private async expiringTrials() {
    const now = new Date();
    const in7d = new Date(Date.now() + 7 * 86_400_000);
    return this.tenantRepo.find({
      where: {
        status: TenantStatus.TRIAL,
        trialEndsAt: Between(now, in7d),
      },
      order: { trialEndsAt: 'ASC' },
      take: 20,
    });
  }
}
