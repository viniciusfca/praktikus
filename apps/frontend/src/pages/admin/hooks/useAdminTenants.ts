import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { adminApi } from '../../../services/admin.api';

export type TenantStatusKey = 'ACTIVE' | 'TRIAL' | 'OVERDUE' | 'SUSPENDED';

export interface TenantFilters {
  status?: TenantStatusKey | 'all';
  segment?: 'WORKSHOP' | 'RECYCLING' | 'all';
  wpp?: 'yes' | 'no' | 'all';
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface TenantRow {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  segment: 'WORKSHOP' | 'RECYCLING';
  status: TenantStatusKey;
  city: string | null;
  state: string | null;
  whatsappEnabled: boolean;
  whatsappPlan: string | null;
  planName: null;
  mrr: null;
  healthScore: null;
  lastSeenAt: null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  createdAt: string;
}

export interface TenantsData {
  data: TenantRow[];
  total: number;
  page: number;
  pageSize: number;
  countersByStatus: Record<TenantStatusKey, number>;
}

export function useAdminTenants(filters: TenantFilters) {
  const [data, setData] = useState<TenantsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQ] = useDebounce(filters.q ?? '', 300);

  const params = useMemo(() => {
    const p: Record<string, string | number> = {
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 25,
    };
    if (filters.status && filters.status !== 'all') p.status = filters.status;
    if (filters.segment && filters.segment !== 'all') p.segment = filters.segment;
    if (filters.wpp && filters.wpp !== 'all') p.wpp = filters.wpp;
    if (debouncedQ.trim()) p.q = debouncedQ.trim();
    return p;
  }, [
    filters.status,
    filters.segment,
    filters.wpp,
    debouncedQ,
    filters.page,
    filters.pageSize,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .get<TenantsData>('/admin/tenants', { params })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Erro');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  return { data, loading, error };
}
