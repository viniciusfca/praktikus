import { ColetaStatus } from '../enums/coleta-status.enum';

export interface Coleta {
  id: string;
  supplierId: string;
  /**
   * Nome do fornecedor associado, devolvido por endpoints de listagem para
   * evitar N+1 no frontend. Endpoints de detalhe podem não preencher este
   * campo — daí o tipo opcional/nullable.
   */
  supplierName?: string | null;
  employeeId: string | null;
  scheduledAt: string;
  status: ColetaStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ColetaComment {
  id: string;
  coletaId: string;
  texto: string;
  createdById: string;
  createdAt: string;
}
