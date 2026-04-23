import { useState, useEffect, useCallback } from 'react';
import { reportsService, type DashboardSummary, type PurchasePeriodEntry, type TopMaterial, type SalesSummary, type PurchasesSummary } from '../../services/recycling/reports.service';

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

export function useTopMaterials(month?: string, limit = 5) {
  const [materials, setMaterials] = useState<TopMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    reportsService.getTopMaterials(month, limit)
      .then(setMaterials)
      .catch(() => setError('Erro ao carregar top materiais'))
      .finally(() => setLoading(false));
  }, [month, limit]);

  useEffect(() => { refetch(); }, [refetch]);

  return { materials, loading, error, refetch };
}

export function useSalesSummary() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    reportsService.getSalesSummary()
      .then(setSummary)
      .catch(() => setError('Erro ao carregar resumo de vendas'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { summary, loading, error, refetch };
}

export function usePurchasesSummary() {
  const [summary, setSummary] = useState<PurchasesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    reportsService.getPurchasesSummary()
      .then(setSummary)
      .catch(() => setError('Erro ao carregar resumo de compras'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { summary, loading, error, refetch };
}
