import { api } from './api';

export interface CompanyProfile {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string | null;
  logoUrl: string | null;
}

export const companiesService = {
  async getProfile(): Promise<CompanyProfile> {
    const { data } = await api.get<CompanyProfile>('/workshop/company');
    return data;
  },
};
