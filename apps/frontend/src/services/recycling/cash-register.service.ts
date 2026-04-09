import { api } from '../api';

export interface CashSession {
  id: string;
  operatorId: string;
  closedBy: string | null;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  status: 'OPEN' | 'CLOSED';
}

export interface CashTransaction {
  id: string;
  cashSessionId: string;
  type: 'IN' | 'OUT';
  paymentMethod: 'CASH' | 'PIX' | 'CARD';
  amount: number;
  description: string | null;
  createdAt: string;
}

export const cashRegisterService = {
  async open(): Promise<CashSession> {
    const { data } = await api.post<CashSession>('/recycling/cash-register/open');
    return data;
  },

  async close(): Promise<CashSession> {
    const { data } = await api.post<CashSession>('/recycling/cash-register/close');
    return data;
  },

  async getCurrent(): Promise<CashSession | null> {
    const { data } = await api.get<CashSession | null>('/recycling/cash-register/current');
    return data;
  },

  async addTransaction(payload: {
    type: 'IN' | 'OUT';
    paymentMethod: 'CASH' | 'PIX' | 'CARD';
    amount: number;
    description?: string;
  }): Promise<CashTransaction> {
    const { data } = await api.post<CashTransaction>('/recycling/cash-register/transactions', payload);
    return data;
  },

  async getTransactions(sessionId: string): Promise<CashTransaction[]> {
    const { data } = await api.get<CashTransaction[]>(`/recycling/cash-register/sessions/${sessionId}/transactions`);
    return data;
  },
};
