import { api } from '../api';
import { PaymentMethod } from '@praktikus/shared';

export { PaymentMethod };

export interface PurchaseItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  operatorId: string;
  cashSessionId: string | null;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  purchasedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface CreatePurchasePayload {
  supplierId: string;
  paymentMethod: PaymentMethod;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  notes?: string;
}

export const purchasesService = {
  async list(page = 1, limit = 20): Promise<{ data: Purchase[]; total: number; page: number; limit: number }> {
    const { data } = await api.get('/recycling/purchases', { params: { page, limit } });
    return data;
  },
  async create(payload: CreatePurchasePayload): Promise<Purchase> {
    const { data } = await api.post<Purchase>('/recycling/purchases', payload);
    return data;
  },
};
