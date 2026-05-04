import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/admin.api';

export interface WhatsappData {
  kpis: {
    adoptionRate: number;
    starterCount: number;
    proCount: number;
    enterpriseCount: number;
    addOnMrr: null;
  };
  using: Array<unknown>;
  notUsing: Array<unknown>;
  adoptionBySegment: Array<{
    segment: 'WORKSHOP' | 'RECYCLING';
    rate: number;
    using: number;
    eligible: number;
  }>;
}

export function useAdminWhatsapp() {
  const [data, setData] = useState<WhatsappData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .get<WhatsappData>('/admin/whatsapp')
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
