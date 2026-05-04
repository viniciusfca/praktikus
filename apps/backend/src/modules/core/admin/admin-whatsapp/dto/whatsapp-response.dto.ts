import { TenantSegment } from '@praktikus/shared';
import { TenantStatus } from '../../../tenancy/tenant.entity';

export interface WhatsappAdoptionTenant {
  id: string;
  nomeFantasia: string;
  segment: TenantSegment;
  status: TenantStatus;
  whatsappPlan: string | null;
  enabledAt: string | null; // por enquanto = updated_at
  monthlyVolume: null; // Fase 1.5
}

export interface WhatsappResponseDto {
  kpis: {
    adoptionRate: number; // 0..1
    starterCount: number; // WhatsappPlan.STARTER
    proCount: number;     // WhatsappPlan.PRO
    enterpriseCount: number; // WhatsappPlan.ENTERPRISE
    addOnMrr: null;
  };
  using: WhatsappAdoptionTenant[];
  notUsing: WhatsappAdoptionTenant[];
  adoptionBySegment: Array<{
    segment: TenantSegment;
    rate: number; // 0..1
    using: number;
    eligible: number; // ACTIVE+TRIAL
  }>;
}
