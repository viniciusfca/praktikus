import { TenantStatus } from '@praktikus/shared';

export type AdminTenantStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';

export const STATUS_LABEL: Record<AdminTenantStatus, string> = {
  ACTIVE: 'Ativo',
  TRIAL: 'Trial',
  OVERDUE: 'Em atraso',
  SUSPENDED: 'Suspenso',
};

export const STATUS_VARIANT: Record<
  AdminTenantStatus,
  'success' | 'info' | 'warning' | 'danger'
> = {
  ACTIVE: 'success',
  TRIAL: 'info',
  OVERDUE: 'warning',
  SUSPENDED: 'danger',
};
