import type { ProductPriceMap } from '@praktikus/shared';
import { api } from '../api';

export interface Product {
  id: string;
  name: string;
  unitId: string;
  pricePerUnit: number;
  prices: ProductPriceMap;
  active: boolean;
}

export interface CreateProductPayload {
  name: string;
  unitId: string;
  active?: boolean;
  prices: ProductPriceMap;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

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
  async create(payload: CreateProductPayload): Promise<Product> {
    const { data } = await api.post<Product>('/recycling/products', payload);
    return data;
  },
  async update(id: string, payload: UpdateProductPayload): Promise<Product> {
    const { data } = await api.patch<Product>(
      `/recycling/products/${id}`,
      payload,
    );
    return data;
  },
};
