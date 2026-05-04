import { TenantSegment } from '@praktikus/shared';

export const SEGMENT_COLOR: Record<TenantSegment, string> = {
  [TenantSegment.WORKSHOP]: 'var(--adm-seg-workshop)',
  [TenantSegment.RECYCLING]: 'var(--adm-seg-recycling)',
};

export const SEGMENT_LABEL: Record<TenantSegment, string> = {
  [TenantSegment.WORKSHOP]: 'Oficina',
  [TenantSegment.RECYCLING]: 'Recicláveis',
};
