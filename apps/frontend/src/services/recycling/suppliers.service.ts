import { api } from '../api';

export interface Supplier {
  id: string;
  name: string;
  document: string | null;
  documentType: 'CPF' | 'CNPJ' | null;
  phone: string | null;
  address: {
    street: string;
    number: string;
    complement?: string;
    city: string;
    state: string;
    zip: string;
  } | null;
}

export interface PaginatedSuppliers {
  data: Supplier[];
  total: number;
  page: number;
  limit: number;
}

export const suppliersService = {
  async list(page = 1, limit = 20, search?: string): Promise<PaginatedSuppliers> {
    const { data } = await api.get<PaginatedSuppliers>('/recycling/suppliers', {
      params: { page, limit, ...(search ? { search } : {}) },
    });
    return data;
  },

  async getById(id: string): Promise<Supplier> {
    const { data } = await api.get<Supplier>(`/recycling/suppliers/${id}`);
    return data;
  },

  async create(payload: Omit<Supplier, 'id'>): Promise<Supplier> {
    const { data } = await api.post<Supplier>('/recycling/suppliers', payload);
    return data;
  },

  async update(id: string, payload: Partial<Omit<Supplier, 'id'>>): Promise<Supplier> {
    const { data } = await api.patch<Supplier>(`/recycling/suppliers/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/recycling/suppliers/${id}`);
  },
};
