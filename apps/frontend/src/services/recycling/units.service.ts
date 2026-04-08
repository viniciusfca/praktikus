import { api } from '../api';

export interface Unit { id: string; name: string; abbreviation: string; }

export const unitsService = {
  async list(): Promise<Unit[]> {
    const { data } = await api.get<Unit[]>('/recycling/units');
    return data;
  },
  async create(payload: { name: string; abbreviation: string }): Promise<Unit> {
    const { data } = await api.post<Unit>('/recycling/units', payload);
    return data;
  },
  async update(id: string, payload: Partial<{ name: string; abbreviation: string }>): Promise<Unit> {
    const { data } = await api.patch<Unit>(`/recycling/units/${id}`, payload);
    return data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/recycling/units/${id}`);
  },
};
