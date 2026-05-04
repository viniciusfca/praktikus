import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/admin.api';

export interface WhatsappAdoptionTenant {
  id: string;
  nomeFantasia: string;
  segment: 'WORKSHOP' | 'RECYCLING';
  status: 'ACTIVE' | 'TRIAL' | 'OVERDUE' | 'SUSPENDED';
  whatsappPlan: string | null;
  enabledAt: string | null;
  monthlyVolume: null;
}

export interface WhatsappData {
  kpis: {
    adoptionRate: number;
    starterCount: number;
    proCount: number;
    enterpriseCount: number;
    addOnMrr: null;
  };
  using: WhatsappAdoptionTenant[];
  notUsing: WhatsappAdoptionTenant[];
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
