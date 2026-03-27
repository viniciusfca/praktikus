import { api } from './api';

export interface CompanyAddress {
  street: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
}

export interface CompanyProfile {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string | null;
  endereco: CompanyAddress | null;
  logoUrl: string | null;
}

export interface UpdateCompanyPayload {
  nomeFantasia?: string;
  razaoSocial?: string;
  telefone?: string;
  endereco?: CompanyAddress;
}

export const companyService = {
  async getProfile(): Promise<CompanyProfile> {
    const { data } = await api.get<CompanyProfile>('/workshop/company');
    return data;
  },

  async updateProfile(payload: UpdateCompanyPayload): Promise<CompanyProfile> {
    const { data } = await api.patch<CompanyProfile>('/workshop/company', payload);
    return data;
  },

  async uploadLogo(file: File): Promise<CompanyProfile> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<CompanyProfile>('/workshop/company/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
