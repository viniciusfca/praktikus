import { api } from '../api';

export interface DashboardSummary {
  totalPurchasedToday: number;
  purchasesCountToday: number;
  cashSession: { status: string; openingBalance: number } | null;
}

export interface PurchasePeriodEntry {
  date: string;
  total: number;
  count: number;
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
};
