import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/admin.api';

export interface OverviewData {
  kpis: {
    activeTenants: { value: number; deltaVsLastMonth: number | null; sparkline: number[] };
    trialTenants: { value: number; deltaVsLastMonth: number | null; sparkline: number[] };
    whatsappTenants: { value: number; deltaVsLastMonth: number | null; sparkline: number[] };
    mrr: { value: null };
  };
  statusDistribution: Array<{ status: string; count: number }>;
  segmentDistribution: Array<{ segment: string; count: number }>;
  ufDistribution: Array<{ uf: string; count: number }>;
  trialsExpiring: Array<{
    tenantId: string;
    nomeFantasia: string;
    segment: string;
    trialEndsAt: string;
    daysLeft: number;
  }>;
}

export function useAdminOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .get<OverviewData>('/admin/overview')
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
  }, [reloadTick]);

  return { data, loading, error, reload: () => setReloadTick((t) => t + 1) };
}
