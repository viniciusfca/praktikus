import { api } from './api';

export type AppointmentStatus = 'PENDENTE' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';

export interface Appointment {
  id: string;
  clienteId: string;
  veiculoId: string;
  dataHora: string;
  duracaoMin: number;
  tipoServico: string | null;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentConflict {
  id: string;
  data_hora: string;
  tipo_servico: string | null;
}

export interface AppointmentResponse {
  data: Appointment;
  conflicts: AppointmentConflict[];
}

export interface AppointmentComment {
  id: string;
  appointmentId: string;
  texto: string;
  createdById: string;
  createdAt: string;
}

export interface CreateAppointmentPayload {
  clienteId: string;
  veiculoId: string;
  dataHora: string;
  duracaoMin?: number;
  tipoServico?: string;
  status?: AppointmentStatus;
}

export const appointmentsApi = {
  async list(params?: {
    date_start?: string;
    date_end?: string;
    status?: string;
  }): Promise<Appointment[]> {
    const { data } = await api.get<Appointment[]>('/workshop/appointments', { params });
    return data;
  },

  async getById(id: string): Promise<Appointment> {
    const { data } = await api.get<Appointment>(`/workshop/appointments/${id}`);
    return data;
  },

  async create(payload: CreateAppointmentPayload): Promise<AppointmentResponse> {
    const { data } = await api.post<AppointmentResponse>('/workshop/appointments', payload);
    return data;
  },

  async update(id: string, payload: Partial<CreateAppointmentPayload>): Promise<AppointmentResponse> {
    const { data } = await api.patch<AppointmentResponse>(`/workshop/appointments/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/appointments/${id}`);
  },
};

export const appointmentCommentsApi = {
  async list(appointmentId: string): Promise<AppointmentComment[]> {
    const { data } = await api.get<AppointmentComment[]>(
      `/workshop/appointments/${appointmentId}/comments`,
    );
    return data;
  },

  async create(appointmentId: string, texto: string): Promise<AppointmentComment> {
    const { data } = await api.post<AppointmentComment>(
      `/workshop/appointments/${appointmentId}/comments`,
      { texto },
    );
    return data;
  },

  async delete(appointmentId: string, commentId: string): Promise<void> {
    await api.delete(`/workshop/appointments/${appointmentId}/comments/${commentId}`);
  },
};
