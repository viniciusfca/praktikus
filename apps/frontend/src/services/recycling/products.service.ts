import { api } from '../api';

export interface Product {
  id: string;
  name: string;
  unitId: string;
  pricePerUnit: number;
  active: boolean;
}

export const productsService = {
  async list(includeInactive = false): Promise<Product[]> {
    const { data } = await api.get<Product[]>('/recycling/products', {
      params: includeInactive ? { includeInactive: 'true' } : {},
    });
    return data;
  },
  async getById(id: string): Promise<Product> {
    const { data } = await api.get<Product>(`/recycling/products/${id}`);
    return data;
  },
  async create(payload: { name: string; unitId: string; pricePerUnit: number }): Promise<Product> {
    const { data } = await api.post<Product>('/recycling/products', payload);
    return data;
  },
  async update(id: string, payload: Partial<{ name: string; unitId: string; pricePerUnit: number; active: boolean }>): Promise<Product> {
    const { data } = await api.patch<Product>(`/recycling/products/${id}`, payload);
    return data;
  },
};
