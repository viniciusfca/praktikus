import { useEffect, useRef } from 'react';
import { useBillingStore } from '../../store/billing.store';

interface Props {
  open: boolean;
  checkoutUrl: string | null;
  onClose: () => void;
  onSuccess: () => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export function AsaasCheckoutPopup({
  open, checkoutUrl, onClose, onSuccess,
  pollIntervalMs = 3000, timeoutMs = 5 * 60 * 1000,
}: Props) {
  const popupRef = useRef<Window | null>(null);
  const { refresh, summary } = useBillingStore();
  const startedAtRef = useRef<number>(0);
  const initialBillingTypeRef = useRef<string | null>(null);

  // Abrir popup quando open=true (CHAMADA SINCRONA num onClick — não use await antes)
  useEffect(() => {
    if (!open || !checkoutUrl) return;
    popupRef.current = window.open(
      checkoutUrl, 'asaas-checkout', 'width=480,height=720,top=100,left=100',
    );
    if (!popupRef.current) {
      alert('Permita popups para este site e tente novamente. Se preferir, abrirei o checkout em uma nova aba.');
      window.location.href = checkoutUrl;
      return;
    }
    startedAtRef.current = Date.now();
    initialBillingTypeRef.current = summary?.billingType ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, checkoutUrl]);

  // Polling enquanto popup aberto
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(async () => {
      // Detectar se popup fechado
      if (popupRef.current?.closed) {
        clearInterval(interval);
        await refresh();
        onClose();
        return;
      }
      // Detectar timeout
      if (Date.now() - startedAtRef.current > timeoutMs) {
        clearInterval(interval);
        try { popupRef.current?.close(); } catch { /* cross-origin */ }
        onClose();
        return;
      }
      // Polling de estado
      await refresh();
      const current = useBillingStore.getState().summary;
      if (
        current?.billingType === 'CREDIT_CARD' &&
        current.billingType !== initialBillingTypeRef.current
      ) {
        clearInterval(interval);
        try { popupRef.current?.close(); } catch { /* cross-origin */ }
        onSuccess();
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [open, refresh, onClose, onSuccess, pollIntervalMs, timeoutMs]);

  return null;
}
