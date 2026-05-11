import { TenantSegment } from '@praktikus/shared';

export interface SegmentBreakdown {
  segment: TenantSegment;
  total: number;
  byStatus: Record<string, number>; // ACTIVE/TRIAL/OVERDUE/SUSPENDED
  whatsappCount: number;
  newLast30Days: number;
  mrr: null; // placeholder Fase 1.5
}

export interface SegmentsResponseDto {
  totalTenants: number;
  segments: SegmentBreakdown[];
}
