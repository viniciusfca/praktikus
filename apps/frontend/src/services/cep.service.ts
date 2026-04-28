import { api } from './api';
import type { CepLookupResponse } from '@praktikus/shared';

export async function lookupCep(cep: string): Promise<CepLookupResponse> {
  const clean = cep.replace(/\D/g, '');
  const { data } = await api.get<CepLookupResponse>(`/cep/${clean}`);
  return data;
}
