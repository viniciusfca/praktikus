import { api } from '../api';

export interface SaleItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  buyerId: string;
  operatorId: string;
  soldAt: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateSalePayload {
  buyerId: string;
  items: SaleItem[];
  notes?: string;
}

export const salesService = {
  async list(page = 1, limit = 20): Promise<{ data: Sale[]; total: number; page: number; limit: number }> {
    const { data } = await api.get('/recycling/sales', { params: { page, limit } });
    return data;
  },
  async create(payload: CreateSalePayload): Promise<Sale> {
    const { data } = await api.post<Sale>('/recycling/sales', payload);
    return data;
  },
};
