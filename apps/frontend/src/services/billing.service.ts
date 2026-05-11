import { api } from './api';

export interface BillingSummary {
  status: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';
  planName: string;
  planValue: number;
  billingType: 'PIX' | 'CREDIT_CARD' | null;
  card: { last4: string; brand: string; expiry: string } | null;
  nextDueDate: string | null;
  trialEndsAt: string | null;
  daysUntilTrialEnds: number | null;
  canceledAt: string | null;
}

export interface OpenInvoice {
  id: string;
  asaasPaymentId: string;
  value: number;
  dueDate: string;
  status: 'PENDING' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'DELETED';
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  pix: { qrCodeBase64: string; copyPaste: string } | null;
}

export interface CheckoutSession {
  checkoutUrl: string;
  sessionId: string;
}

export const billingService = {
  getSummary: () => api.get<BillingSummary>('/billing').then((r) => r.data),
  getOpenInvoice: () =>
    api.get<OpenInvoice | null>('/billing/invoices/open').then((r) => r.data),
  listInvoices: () =>
    api.get<OpenInvoice[]>('/billing/invoices').then((r) => r.data),
  regeneratePix: (invoiceId: string) =>
    api
      .post<{ qrCodeBase64: string; copyPaste: string }>(
        `/billing/invoices/${invoiceId}/pix`,
      )
      .then((r) => r.data),
  startCardCheckout: () =>
    api
      .post<CheckoutSession>('/billing/checkout-session')
      .then((r) => r.data),
  startInvoiceCheckout: (invoiceId: string) =>
    api
      .post<CheckoutSession>(`/billing/invoices/${invoiceId}/checkout`)
      .then((r) => r.data),
  removeCard: () => api.delete('/billing/card').then(() => {}),
  cancel: () => api.post('/billing/cancel').then(() => {}),
  reactivate: () =>
    api.post<CheckoutSession>('/billing/reactivate').then((r) => r.data),
};
