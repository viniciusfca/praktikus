import { useState, useEffect } from 'react';
import { reportsService, DashboardSummary } from '../../services/recycling/reports.service';

export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsService.getDashboardSummary()
      .then(setSummary)
      .catch(() => setError('Erro ao carregar resumo'))
      .finally(() => setLoading(false));
  }, []);

  return { summary, loading, error };
}
