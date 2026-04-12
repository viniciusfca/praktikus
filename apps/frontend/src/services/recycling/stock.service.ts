import { api } from '../api';

export interface StockBalance {
  productId: string;
  productName: string;
  unitAbbreviation: string;
  balance: number;
}

export interface StockMovement {
  id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  referenceType: string | null;
  movedAt: string;
}

export interface DailyPurchaseTotal {
  productId: string;
  productName: string;
  unitAbbreviation: string;
  totalQuantity: number;
}

export const stockService = {
  async getBalances(): Promise<StockBalance[]> {
    const { data } = await api.get<StockBalance[]>('/recycling/stock');
    return data;
  },
  async getMovements(productId: string): Promise<StockMovement[]> {
    const { data } = await api.get<StockMovement[]>(`/recycling/stock/${productId}/movements`);
    return data;
  },
  async getDailyTotals(date: string): Promise<DailyPurchaseTotal[]> {
    const { data } = await api.get<DailyPurchaseTotal[]>('/recycling/stock/daily', { params: { date } });
    return data;
  },
};
