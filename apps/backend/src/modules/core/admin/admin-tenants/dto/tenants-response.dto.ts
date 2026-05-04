import { TenantSegment } from '@praktikus/shared';
import { TenantStatus } from '../../../tenancy/tenant.entity';

export interface TenantListItem {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  segment: TenantSegment;
  status: TenantStatus;
  city: string | null;
  state: string | null;
  whatsappEnabled: boolean;
  whatsappPlan: string | null;
  // Fase 1.5+: planName, mrr, healthScore, lastSeenAt, userCount
  planName: null;
  mrr: null;
  healthScore: null;
  lastSeenAt: null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  createdAt: string;
}

export interface TenantsResponseDto {
  data: TenantListItem[];
  total: number;
  page: number;
  pageSize: number;
  countersByStatus: Record<TenantStatus, number>;
}
