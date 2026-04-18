import { useState, useEffect, useCallback } from 'react';
import { reportsService, type DashboardSummary, type PurchasePeriodEntry } from '../../services/recycling/reports.service';

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

export function usePurchasesByPeriod() {
  const [rows, setRows] = useState<PurchasePeriodEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const fetch = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsService.getPurchasesByPeriod(startDate, endDate);
      setRows(result);
      setSearched(true);
    } catch {
      setError('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, []);

  return { rows, loading, error, searched, fetch };
}
