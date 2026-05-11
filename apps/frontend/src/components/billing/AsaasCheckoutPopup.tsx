import { useEffect, useRef } from 'react';
import { useBillingStore, type BillingState } from '../../store/billing.store';

interface Props {
  open: boolean;
  popupRef: React.RefObject<Window | null>;
  onClose: () => void;
  onSuccess: () => void;
  /** Snapshot of state before the popup opened, for detecting success */
  successDetector: ((current: BillingState) => boolean) | null;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export function AsaasCheckoutPopup({
  open, popupRef, onClose, onSuccess, successDetector,
  pollIntervalMs = 3000, timeoutMs = 5 * 60 * 1000,
}: Props) {
  const { refresh } = useBillingStore();
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    startedAtRef.current = Date.now();

    const interval = setInterval(async () => {
      // Popup was closed by user
      if (popupRef.current?.closed) {
        clearInterval(interval);
        await refresh();
        onClose();
        return;
      }
      // Timeout
      if (Date.now() - startedAtRef.current > timeoutMs) {
        clearInterval(interval);
        try { popupRef.current?.close(); } catch { /* cross-origin */ }
        onClose();
        return;
      }
      // Poll state
      await refresh();
      const currentState = useBillingStore.getState();
      if (successDetector?.(currentState)) {
        clearInterval(interval);
        try { popupRef.current?.close(); } catch { /* cross-origin */ }
        onSuccess();
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [open, popupRef, refresh, onClose, onSuccess, successDetector, pollIntervalMs, timeoutMs]);

  return null;
}
