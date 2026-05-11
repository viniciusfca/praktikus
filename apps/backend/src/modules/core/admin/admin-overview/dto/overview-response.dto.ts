import { TenantSegment } from '@praktikus/shared';

export interface OverviewKpi {
  value: number;
  deltaVsLastMonth: number | null;
  sparkline: number[]; // 6 itens (mês -5 ... mês 0)
}

export interface OverviewSegmentDistribution {
  segment: TenantSegment;
  count: number;
}

export interface OverviewUfDistribution {
  uf: string;
  count: number;
}

export interface OverviewTrialExpiring {
  tenantId: string;
  nomeFantasia: string;
  segment: TenantSegment;
  trialEndsAt: string;
  daysLeft: number;
}

export interface OverviewResponseDto {
  kpis: {
    activeTenants: OverviewKpi;
    trialTenants: OverviewKpi;
    whatsappTenants: OverviewKpi;
    mrr: { value: null };
  };
  statusDistribution: Array<{ status: string; count: number }>;
  segmentDistribution: OverviewSegmentDistribution[];
  ufDistribution: OverviewUfDistribution[];
  trialsExpiring: OverviewTrialExpiring[];
}
