import axios from 'axios';
import { api } from './api';

export type SoStatus = 'ORCAMENTO' | 'APROVADO' | 'EM_EXECUCAO' | 'AGUARDANDO_PECA' | 'FINALIZADA' | 'ENTREGUE';
export type SoPaymentStatus = 'PENDENTE' | 'PAGO';

export interface ServiceOrder {
  id: string;
  appointmentId: string | null;
  clienteId: string;
  veiculoId: string;
  status: SoStatus;
  statusPagamento: SoPaymentStatus;
  kmEntrada: string | null;
  combustivel: string | null;
  observacoesEntrada: string | null;
  approvalToken: string | null;
  approvalExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SoItemService {
  id: string;
  soId: string;
  catalogServiceId: string;
  nomeServico: string;
  valor: number;
  mecanicoId: string | null;
  createdAt: string;
}

export interface SoItemPart {
  id: string;
  soId: string;
  catalogPartId: string;
  nomePeca: string;
  quantidade: number;
  valorUnitario: number;
  createdAt: string;
}

export interface ServiceOrderDetail extends ServiceOrder {
  itemsServices: SoItemService[];
  itemsParts: SoItemPart[];
}

export interface CreateServiceOrderPayload {
  clienteId: string;
  veiculoId: string;
  appointmentId?: string;
  kmEntrada?: string;
  combustivel?: string;
  observacoesEntrada?: string;
}

export interface CreateSoItemServicePayload {
  catalogServiceId: string;
  nomeServico: string;
  valor: number;
  mecanicoId?: string;
}

export interface CreateSoItemPartPayload {
  catalogPartId: string;
  nomePeca: string;
  quantidade: number;
  valorUnitario: number;
}

export interface QuoteData {
  so: { id: string; status: string; createdAt: string };
  empresa: { nome_fantasia: string } | null;
  cliente: { nome: string; cpf_cnpj: string } | null;
  veiculo: { placa: string; marca: string; modelo: string; ano: number } | null;
  itemsServices: SoItemService[];
  itemsParts: SoItemPart[];
  total: number;
}

export const serviceOrdersApi = {
  async list(params?: { status?: string; date_start?: string; date_end?: string }): Promise<ServiceOrder[]> {
    const { data } = await api.get<ServiceOrder[]>('/workshop/service-orders', { params });
    return data;
  },

  async getById(id: string): Promise<ServiceOrderDetail> {
    const { data } = await api.get<ServiceOrderDetail>(`/workshop/service-orders/${id}`);
    return data;
  },

  async create(payload: CreateServiceOrderPayload): Promise<ServiceOrder> {
    const { data } = await api.post<ServiceOrder>('/workshop/service-orders', payload);
    return data;
  },

  async update(id: string, payload: Partial<CreateServiceOrderPayload>): Promise<ServiceOrder> {
    const { data } = await api.patch<ServiceOrder>(`/workshop/service-orders/${id}`, payload);
    return data;
  },

  async patchStatus(id: string, status: SoStatus): Promise<ServiceOrder> {
    const { data } = await api.patch<ServiceOrder>(`/workshop/service-orders/${id}/status`, { status });
    return data;
  },

  async patchPaymentStatus(id: string, statusPagamento: SoPaymentStatus): Promise<ServiceOrder> {
    const { data } = await api.patch<ServiceOrder>(`/workshop/service-orders/${id}/payment-status`, { statusPagamento });
    return data;
  },

  async generateApprovalToken(id: string): Promise<{ token: string; expiresAt: string }> {
    const { data } = await api.post<{ token: string; expiresAt: string }>(`/workshop/service-orders/${id}/approval-token`);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/workshop/service-orders/${id}`);
  },
};

export const soItemsServicesApi = {
  async create(soId: string, payload: CreateSoItemServicePayload): Promise<SoItemService> {
    const { data } = await api.post<SoItemService>(`/workshop/service-orders/${soId}/items/services`, payload);
    return data;
  },

  async delete(soId: string, itemId: string): Promise<void> {
    await api.delete(`/workshop/service-orders/${soId}/items/services/${itemId}`);
  },
};

export const soItemsPartsApi = {
  async create(soId: string, payload: CreateSoItemPartPayload): Promise<SoItemPart> {
    const { data } = await api.post<SoItemPart>(`/workshop/service-orders/${soId}/items/parts`, payload);
    return data;
  },

  async delete(soId: string, itemId: string): Promise<void> {
    await api.delete(`/workshop/service-orders/${soId}/items/parts/${itemId}`);
  },
};

// Public API — no auth header (separate axios instance)
const publicApi = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api',
});

export const publicQuotesApi = {
  async get(token: string): Promise<QuoteData> {
    const { data } = await publicApi.get<QuoteData>(`/public/quotes/${token}`);
    return data;
  },

  async approve(token: string): Promise<void> {
    await publicApi.post(`/public/quotes/${token}/approve`);
  },

  async reject(token: string): Promise<void> {
    await publicApi.post(`/public/quotes/${token}/reject`);
  },
};
