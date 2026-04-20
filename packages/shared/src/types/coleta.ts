import { ColetaStatus } from '../enums/coleta-status.enum';

export interface Coleta {
  id: string;
  supplierId: string;
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
