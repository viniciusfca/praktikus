import { create } from 'zustand';
import {
  billingService,
  type BillingSummary,
  type OpenInvoice,
} from '../services/billing.service';

export interface BillingState {
  summary: BillingSummary | null;
  openInvoice: OpenInvoice | null;
  history: OpenInvoice[];
  loading: boolean;
  error: string | null;
  popupOpen: boolean;
  refresh: () => Promise<void>;
  setPopupOpen: (open: boolean) => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  summary: null,
  openInvoice: null,
  history: [],
  loading: false,
  error: null,
  popupOpen: false,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [summary, openInvoice, history] = await Promise.all([
        billingService.getSummary(),
        billingService.getOpenInvoice(),
        billingService.listInvoices(),
      ]);
      set({ summary, openInvoice, history, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
  setPopupOpen: (open) => set({ popupOpen: open }),
}));
