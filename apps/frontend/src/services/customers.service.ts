import { api } from './api';

export interface Customer {
  id: string;
  nome: string;
  cpfCnpj: string;
  whatsapp: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCustomerPayload {
  nome: string;
  cpfCnpj: string;
  whatsapp?: string;
  email?: string;
}

export const customersService = {
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Customer>> {
    const { data } = await api.get<PaginatedResponse<Customer>>(
      '/workshop/customers',
      { params },
    );
    return data;
  },

  async getById(id: string): Promise<Customer> {
    const { data } = await api.get<Customer>(`/workshop/customers/${id}`);
    return data;
  },

  async create(payload: CreateCustomerPayload): Promise<Customer> {
    const { data } = await api.post<Customer>('/workshop/customers', payload);
    return data;
  },

  async update(id: string, payload: Partial<CreateCustomerPayload>): Promise<Customer> {
    const { data } = await api.patch<Customer>(`/workshop/customers/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/customers/${id}`);
  },
};
