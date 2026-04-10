import { api } from '../api';

export interface Buyer {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  contactName: string | null;
  createdAt: string;
}

export const buyersService = {
  async list(page = 1, limit = 20, search?: string): Promise<{ data: Buyer[]; total: number; page: number; limit: number }> {
    const { data } = await api.get('/recycling/buyers', { params: { page, limit, search } });
    return data;
  },
  async getById(id: string): Promise<Buyer> {
    const { data } = await api.get<Buyer>(`/recycling/buyers/${id}`);
    return data;
  },
  async create(payload: Omit<Buyer, 'id' | 'createdAt'>): Promise<Buyer> {
    const { data } = await api.post<Buyer>('/recycling/buyers', payload);
    return data;
  },
  async update(id: string, payload: Partial<Omit<Buyer, 'id' | 'createdAt'>>): Promise<Buyer> {
    const { data } = await api.patch<Buyer>(`/recycling/buyers/${id}`, payload);
    return data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/recycling/buyers/${id}`);
  },
};
