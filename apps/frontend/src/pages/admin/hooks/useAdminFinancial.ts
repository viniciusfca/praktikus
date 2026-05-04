import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/admin.api';

export interface FinancialData {
  kpis: {
    mrr: null;
    arr: null;
    averageTicket: null;
    churn30d: null;
  };
  basicDistribution: {
    active: number;
    overdue: number;
    suspended: number;
    suspendedLast30Days: number;
  };
  recentCharges: [];
}

export function useAdminFinancial() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .get<FinancialData>('/admin/financial')
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
  }, []);

  return { data, loading, error };
}
