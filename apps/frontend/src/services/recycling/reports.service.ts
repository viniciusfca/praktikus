import { api } from '../api';
import type { TopMaterial } from '@praktikus/shared';

export type { TopMaterial };

export interface DashboardSummary {
  totalPurchasedToday: number;
  purchasesCountToday: number;
  totalPurchasedMonth: number;
  purchasesCountMonth: number;
  cashSession: { status: string; openingBalance: number; currentBalance: number } | null;
}

export interface PurchasePeriodEntry {
  date: string;
  total: number;
  count: number;
}

export interface SalesSummary {
  today: { total: number; count: number };
  week: { total: number; count: number };
  month: { total: number; count: number };
}

export interface PurchasesSummary {
  today: { total: number; count: number };
  week: { total: number; count: number };
  month: { total: number; count: number };
}

export const reportsService = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>('/recycling/reports/dashboard');
    return data;
  },
  async getPurchasesByPeriod(startDate: string, endDate: string): Promise<PurchasePeriodEntry[]> {
    const { data } = await api.get<PurchasePeriodEntry[]>('/recycling/reports/purchases', {
      params: { startDate, endDate },
    });
    return data;
  },
  async getTopMaterials(month?: string, limit = 5): Promise<TopMaterial[]> {
    const { data } = await api.get<TopMaterial[]>('/recycling/reports/top-materials', {
      params: { ...(month ? { month } : {}), limit },
    });
    return data;
  },
  async getSalesSummary(): Promise<SalesSummary> {
    const { data } = await api.get<SalesSummary>('/recycling/reports/sales-summary');
    return data;
  },
  async getPurchasesSummary(): Promise<PurchasesSummary> {
    const { data } = await api.get<PurchasesSummary>('/recycling/reports/purchases-summary');
    return data;
  },
};
