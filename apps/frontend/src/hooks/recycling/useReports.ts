import { useState, useEffect, useCallback } from 'react';
import {
  reportsService,
  type DashboardSummary,
  type DashboardStats,
  type PurchasePeriodEntry,
  type SalesPeriodEntry,
  type TopMaterial,
  type TopMaterialRanking,
  type SalesSummary,
  type PurchasesSummary,
} from '../../services/recycling/reports.service';

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

export function useSalesByPeriod() {
  const [rows, setRows] = useState<SalesPeriodEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const fetch = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsService.getSalesByPeriod(startDate, endDate);
      setRows(result);
      setSearched(true);
    } catch {
      setError('Erro ao carregar relatório de vendas');
    } finally {
      setLoading(false);
    }
  }, []);

  return { rows, loading, error, searched, fetch };
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    reportsService.getDashboardStats()
      .then(setStats)
      .catch(() => setError('Erro ao carregar estatísticas do dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { stats, loading, error, refetch };
}

export function useTopMaterialsRanking(month?: string, limit = 10) {
  const [rows, setRows] = useState<TopMaterialRanking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const fetch = useCallback(async (m?: string, l = limit) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsService.getTopMaterialsRanking(m, l);
      setRows(result);
      setSearched(true);
    } catch {
      setError('Erro ao carregar top materiais');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { fetch(month, limit); }, [fetch, month, limit]);

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
