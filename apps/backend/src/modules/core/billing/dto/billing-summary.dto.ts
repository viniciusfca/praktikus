import { TenantStatus } from '../../tenancy/tenant.entity';

export interface BillingSummaryDto {
  status: TenantStatus;
  planName: string;
  planValue: number;
  billingType: 'PIX' | 'CREDIT_CARD' | null;
  card: { last4: string; brand: string; expiry: string } | null;
  nextDueDate: string | null;
  trialEndsAt: string | null;
  daysUntilTrialEnds: number | null;
  canceledAt: string | null;
}
