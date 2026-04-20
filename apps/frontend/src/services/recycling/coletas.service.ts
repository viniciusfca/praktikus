import { api } from '../api';
import { ColetaStatus, type Coleta, type ColetaComment } from '@praktikus/shared';

export { ColetaStatus };
export type { Coleta, ColetaComment };

export interface CreateColetaPayload {
  supplierId: string;
  employeeId?: string | null;
  scheduledAt: string;
  notes?: string | null;
}

export type UpdateColetaPayload = Partial<CreateColetaPayload>;

export interface ListColetasParams {
  start?: string;
  end?: string;
  status?: ColetaStatus;
  limit?: number;
}

export const coletasService = {
  async list(params: ListColetasParams = {}): Promise<Coleta[]> {
    const { data } = await api.get<Coleta[]>('/recycling/coletas', { params });
    return data;
  },

  async upcoming(limit = 4): Promise<Coleta[]> {
    const { data } = await api.get<Coleta[]>('/recycling/coletas/upcoming', { params: { limit } });
    return data;
  },

  async getById(id: string): Promise<Coleta> {
    const { data } = await api.get<Coleta>(`/recycling/coletas/${id}`);
    return data;
  },

  async create(payload: CreateColetaPayload): Promise<Coleta> {
    const { data } = await api.post<Coleta>('/recycling/coletas', payload);
    return data;
  },

  async update(id: string, payload: UpdateColetaPayload): Promise<Coleta> {
    const { data } = await api.put<Coleta>(`/recycling/coletas/${id}`, payload);
    return data;
  },

  async updateStatus(
    id: string,
    status: ColetaStatus.CONCLUIDA | ColetaStatus.CANCELADA,
  ): Promise<Coleta> {
    const { data } = await api.patch<Coleta>(`/recycling/coletas/${id}/status`, { status });
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/recycling/coletas/${id}`);
  },
};

export const coletaCommentsService = {
  async list(coletaId: string): Promise<ColetaComment[]> {
    const { data } = await api.get<ColetaComment[]>(`/recycling/coletas/${coletaId}/comments`);
    return data;
  },
  async create(coletaId: string, texto: string): Promise<ColetaComment> {
    const { data } = await api.post<ColetaComment>(
      `/recycling/coletas/${coletaId}/comments`,
      { texto },
    );
    return data;
  },
  async delete(coletaId: string, commentId: string): Promise<void> {
    await api.delete(`/recycling/coletas/${coletaId}/comments/${commentId}`);
  },
};
