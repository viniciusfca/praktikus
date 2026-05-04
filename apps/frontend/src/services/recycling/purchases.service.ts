import { api } from '../api';
import { PaymentMethod } from '@praktikus/shared';

export { PaymentMethod };

export interface Purchase {
  id: string;
  supplierId: string;
  priceTableId: string;
  operatorId: string;
  cashSessionId: string | null;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  purchasedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface PurchaseListItem {
  id: string;
  purchasedAt: string;
  supplierId: string;
  supplierName: string;
  paymentMethod: PaymentMethod;
  total: number;
  itemCount: number;
  firstProductName: string | null;
  totalKg: number;
  notes: string | null;
}

export interface PurchaseDetailItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PurchaseDetail {
  id: string;
  purchasedAt: string;
  supplier: {
    id: string;
    name: string;
    document: string | null;
    documentType: 'CPF' | 'CNPJ' | null;
  };
  operator: { id: string; name: string };
  paymentMethod: PaymentMethod;
  notes: string | null;
  total: number;
  items: PurchaseDetailItem[];
}

export interface CreatePurchasePayload {
  supplierId: string;
  priceTableId: string;
  paymentMethod: PaymentMethod;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  notes?: string;
}

export const purchasesService = {
  async list(page = 1, limit = 20): Promise<{ data: PurchaseListItem[]; total: number; page: number; limit: number }> {
    const { data } = await api.get('/recycling/purchases', { params: { page, limit } });
    return data;
  },
  async getById(id: string): Promise<PurchaseDetail> {
    const { data } = await api.get<PurchaseDetail>(`/recycling/purchases/${id}`);
    return data;
  },
  async create(payload: CreatePurchasePayload): Promise<Purchase> {
    const { data } = await api.post<Purchase>('/recycling/purchases', payload);
    return data;
  },
};
