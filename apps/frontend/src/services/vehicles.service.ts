import { api } from './api';
import type { PaginatedResponse } from './customers.service';

export interface Vehicle {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  km: number;
  customerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehiclePayload {
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  km: number;
  customerId: string;
}

export interface VehicleSoItemService {
  id: string;
  nomeServico: string;
  valor: number;
  mecanicoId: string | null;
}

export interface VehicleSoItemPart {
  id: string;
  nomePeca: string;
  quantidade: number;
  valorUnitario: number;
}

export interface VehicleServiceOrder {
  id: string;
  status: string;
  statusPagamento: string;
  kmEntrada: string | null;
  combustivel: string | null;
  observacoesEntrada: string | null;
  createdAt: string;
  itemsServices: VehicleSoItemService[];
  itemsParts: VehicleSoItemPart[];
  total: number;
}

export const vehiclesService = {
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Vehicle>> {
    const { data } = await api.get<PaginatedResponse<Vehicle>>(
      '/workshop/vehicles',
      { params },
    );
    return data;
  },

  async getById(id: string): Promise<Vehicle> {
    const { data } = await api.get<Vehicle>(`/workshop/vehicles/${id}`);
    return data;
  },

  async create(payload: CreateVehiclePayload): Promise<Vehicle> {
    const { data } = await api.post<Vehicle>('/workshop/vehicles', payload);
    return data;
  },

  async update(id: string, payload: Partial<CreateVehiclePayload>): Promise<Vehicle> {
    const { data } = await api.patch<Vehicle>(`/workshop/vehicles/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/vehicles/${id}`);
  },

  async getServiceOrders(id: string): Promise<VehicleServiceOrder[]> {
    const { data } = await api.get<VehicleServiceOrder[]>(
      `/workshop/vehicles/${id}/service-orders`,
    );
    return data;
  },
};
