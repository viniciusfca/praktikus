import { api } from './api';
import type { PaginatedResponse } from './customers.service';

export interface CatalogService {
  id: string;
  nome: string;
  descricao: string | null;
  precoPadrao: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogPart {
  id: string;
  nome: string;
  codigo: string | null;
  precoUnitario: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCatalogServicePayload {
  nome: string;
  descricao?: string;
  precoPadrao: number;
}

export interface CreateCatalogPartPayload {
  nome: string;
  codigo?: string;
  precoUnitario: number;
}

export const catalogServicesApi = {
  async list(params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<CatalogService>> {
    const { data } = await api.get<PaginatedResponse<CatalogService>>('/workshop/catalog/services', { params });
    return data;
  },
  async getById(id: string): Promise<CatalogService> {
    const { data } = await api.get<CatalogService>(`/workshop/catalog/services/${id}`);
    return data;
  },
  async create(payload: CreateCatalogServicePayload): Promise<CatalogService> {
    const { data } = await api.post<CatalogService>('/workshop/catalog/services', payload);
    return data;
  },
  async update(id: string, payload: Partial<CreateCatalogServicePayload>): Promise<CatalogService> {
    const { data } = await api.patch<CatalogService>(`/workshop/catalog/services/${id}`, payload);
    return data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/catalog/services/${id}`);
  },
};

export const catalogPartsApi = {
  async list(params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<CatalogPart>> {
    const { data } = await api.get<PaginatedResponse<CatalogPart>>('/workshop/catalog/parts', { params });
    return data;
  },
  async getById(id: string): Promise<CatalogPart> {
    const { data } = await api.get<CatalogPart>(`/workshop/catalog/parts/${id}`);
    return data;
  },
  async create(payload: CreateCatalogPartPayload): Promise<CatalogPart> {
    const { data } = await api.post<CatalogPart>('/workshop/catalog/parts', payload);
    return data;
  },
  async update(id: string, payload: Partial<CreateCatalogPartPayload>): Promise<CatalogPart> {
    const { data } = await api.patch<CatalogPart>(`/workshop/catalog/parts/${id}`, payload);
    return data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/catalog/parts/${id}`);
  },
};
