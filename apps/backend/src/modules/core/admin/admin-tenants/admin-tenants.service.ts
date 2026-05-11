import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity, TenantStatus } from '../../tenancy/tenant.entity';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { TenantListItem, TenantsResponseDto } from './dto/tenants-response.dto';

@Injectable()
export class AdminTenantsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async list(query: ListTenantsQueryDto): Promise<TenantsResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.repo
      .createQueryBuilder('t')
      .orderBy('t.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }
    if (query.segment) {
      qb.andWhere('t.segment = :segment', { segment: query.segment });
    }
    if (query.wpp) {
      qb.andWhere('t.whatsapp_enabled = :wpp', { wpp: query.wpp === 'yes' });
    }
    if (query.q && query.q.trim().length > 0) {
      qb.andWhere(
        `(t.nome_fantasia ILIKE :q OR t.razao_social ILIKE :q OR t.slug ILIKE :q OR t.cnpj ILIKE :q)`,
        { q: `%${query.q.trim()}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    const [active, trial, overdue, suspended] = await Promise.all([
      this.repo.count({ where: { status: TenantStatus.ACTIVE } }),
      this.repo.count({ where: { status: TenantStatus.TRIAL } }),
      this.repo.count({ where: { status: TenantStatus.OVERDUE } }),
      this.repo.count({ where: { status: TenantStatus.SUSPENDED } }),
    ]);

    return {
      data: rows.map((t) => this.toItem(t)),
      total,
      page,
      pageSize,
      countersByStatus: {
        [TenantStatus.ACTIVE]: active,
        [TenantStatus.TRIAL]: trial,
        [TenantStatus.OVERDUE]: overdue,
        [TenantStatus.SUSPENDED]: suspended,
      },
    };
  }

  private toItem(t: TenantEntity): TenantListItem {
    const trialDaysLeft =
      t.trialEndsAt && t.trialEndsAt.getTime() > Date.now()
        ? Math.ceil((t.trialEndsAt.getTime() - Date.now()) / 86_400_000)
        : null;
    return {
      id: t.id,
      nomeFantasia: t.nomeFantasia,
      razaoSocial: t.razaoSocial,
      cnpj: t.cnpj,
      segment: t.segment,
      status: t.status,
      city: t.endereco?.city ?? null,
      state: t.endereco?.state ?? null,
      whatsappEnabled: t.whatsappEnabled,
      whatsappPlan: t.whatsappPlan ?? null,
      planName: null,
      mrr: null,
      healthScore: null,
      lastSeenAt: null,
      trialEndsAt: t.trialEndsAt ? t.trialEndsAt.toISOString() : null,
      trialDaysLeft,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
