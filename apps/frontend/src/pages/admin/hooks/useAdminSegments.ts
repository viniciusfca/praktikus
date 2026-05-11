import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/admin.api';

export interface SegmentsData {
  totalTenants: number;
  segments: Array<{
    segment: 'WORKSHOP' | 'RECYCLING';
    total: number;
    byStatus: Record<string, number>;
    whatsappCount: number;
    newLast30Days: number;
    mrr: null;
  }>;
}

export function useAdminSegments() {
  const [data, setData] = useState<SegmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .get<SegmentsData>('/admin/segments')
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
