import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { FinancialResponseDto } from './dto/financial-response.dto';

@Injectable()
export class AdminFinancialService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async get(): Promise<FinancialResponseDto> {
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const [active, overdue, suspended, suspendedLast30] = await Promise.all([
      this.repo.count({ where: { status: TenantStatus.ACTIVE } }),
      this.repo.count({ where: { status: TenantStatus.OVERDUE } }),
      this.repo.count({ where: { status: TenantStatus.SUSPENDED } }),
      this.repo.count({
        where: {
          status: TenantStatus.SUSPENDED,
          updatedAt: MoreThan(cutoff),
        },
      }),
    ]);
    return {
      kpis: { mrr: null, arr: null, averageTicket: null, churn30d: null },
      basicDistribution: {
        active,
        overdue,
        suspended,
        suspendedLast30Days: suspendedLast30,
      },
      recentCharges: [],
    };
  }
}
