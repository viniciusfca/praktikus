import { api } from './api';

export interface ReportOsStatus {
  status: string;
  count: number;
}

export interface ReportMes {
  mes: string;
  servicos: number;
  pecas: number;
  total: number;
}

export interface ReportTopServico {
  nomeServico: string;
  quantidade: number;
  receita: number;
}

export interface ReportData {
  periodo: { dateStart: string; dateEnd: string };
  faturamentoTotal: number;
  faturamentoServicos: number;
  faturamentoPecas: number;
  totalOs: number;
  osPagas: number;
  osPorStatus: ReportOsStatus[];
  faturamentoPorMes: ReportMes[];
  topServicos: ReportTopServico[];
}

export const reportsApi = {
  async get(dateStart: string, dateEnd: string, signal?: AbortSignal): Promise<ReportData> {
    const { data } = await api.get<ReportData>('/workshop/reports', {
      params: { date_start: dateStart, date_end: dateEnd },
      signal,
    });
    return data;
  },
};
