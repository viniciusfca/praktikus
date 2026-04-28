import { PaymentMethod } from '@praktikus/shared';
import { api } from '../api';

export interface SaleItemPayload {
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

export interface SaleListItem {
  id: string;
  soldAt: string;
  buyerId: string;
  buyerName: string;
  total: number;
  itemCount: number;
  firstProductName: string | null;
  totalKg: number;
  notes: string | null;
}

export interface SaleDetailItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleDetail {
  id: string;
  soldAt: string;
  buyer: {
    id: string;
    name: string;
    document: string | null;
    documentType: 'CPF' | 'CNPJ' | null;
  };
  operator: { id: string; name: string };
  notes: string | null;
  total: number;
  items: SaleDetailItem[];
}

export interface CreateSalePayload {
  buyerId: string;
  items: SaleItemPayload[];
  paymentMethod: PaymentMethod;
  notes?: string;
}

export const salesService = {
  async list(page = 1, limit = 20): Promise<{ data: SaleListItem[]; total: number; page: number; limit: number }> {
    const { data } = await api.get('/recycling/sales', { params: { page, limit } });
    return data;
  },
  async getById(id: string): Promise<SaleDetail> {
    const { data } = await api.get<SaleDetail>(`/recycling/sales/${id}`);
    return data;
  },
  async create(payload: CreateSalePayload): Promise<Sale> {
    const { data } = await api.post<Sale>('/recycling/sales', payload);
    return data;
  },
};
