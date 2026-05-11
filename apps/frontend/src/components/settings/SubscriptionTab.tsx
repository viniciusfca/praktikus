import { useEffect, useRef, useState } from 'react';
import { CAlert, CSpinner } from '@coreui/react';
import { Card, CardTitle } from './Card';
import { useBillingStore, type BillingState } from '../../store/billing.store';
import { billingService } from '../../services/billing.service';
import { BillingStatusCard } from '../billing/BillingStatusCard';
import { PaymentMethodCard } from '../billing/PaymentMethodCard';
import { OpenInvoiceCard } from '../billing/OpenInvoiceCard';
import { InvoiceHistoryTable } from '../billing/InvoiceHistoryTable';
import { CancelSubscriptionDialog } from '../billing/CancelSubscriptionDialog';
import { AsaasCheckoutPopup } from '../billing/AsaasCheckoutPopup';

export function SubscriptionTab() {
  const { summary, openInvoice, history, loading, error, refresh, popupOpen, setPopupOpen } = useBillingStore();
  const [cancelOpen, setCancelOpen] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const [successDetector, setSuccessDetector] = useState<((s: BillingState) => boolean) | null>(null);

  useEffect(() => { refresh(); }, [refresh]);

  const resetPopupState = () => {
    popupRef.current = null;
    setPopupOpen(false);
    setSuccessDetector(null);
  };

  // SINCRONO em onClick (sem await): abre popup imediatamente, faz request em background
  const startCardCheckout = () => {
    // 1. Open the window SYNCHRONOUSLY (response to click)
    popupRef.current = window.open('about:blank', 'asaas-checkout', 'width=480,height=720,top=100,left=100');
    if (!popupRef.current) {
      alert('Permita popups para este site e tente novamente.');
      return;
    }
    setPopupOpen(true);

    // 2. Capture the success criterion BEFORE the await
    const initialBillingType = summary?.billingType ?? null;
    const initialCardLast4 = summary?.card?.last4 ?? null;
    setSuccessDetector(() => (current: BillingState) => {
      const currentSummary = current.summary;
      if (currentSummary?.billingType !== 'CREDIT_CARD') return false;
      // Card was added (previously not CREDIT_CARD) or card last4 changed (replacement)
      return (
        initialBillingType !== 'CREDIT_CARD' ||
        currentSummary?.card?.last4 !== initialCardLast4
      );
    });

    // 3. Fetch URL and navigate the (already-open) popup to it
    billingService.startCardCheckout()
      .then((session) => {
        if (popupRef.current && !popupRef.current.closed) {
          try {
            popupRef.current.location.href = session.checkoutUrl;
          } catch {
            // cross-origin assignment — fall back to replacing
            popupRef.current.location.replace(session.checkoutUrl);
          }
        }
      })
      .catch(() => {
        try { popupRef.current?.close(); } catch { /* cross-origin */ }
        resetPopupState();
        alert('Falha ao iniciar o checkout. Tente novamente.');
      });
  };

  const startInvoiceCheckout = (invoiceId: string) => {
    popupRef.current = window.open('about:blank', 'asaas-checkout', 'width=480,height=720,top=100,left=100');
    if (!popupRef.current) {
      alert('Permita popups para este site e tente novamente.');
      return;
    }
    setPopupOpen(true);

    // Snapshot the open invoice (to detect when it transitions to CONFIRMED / disappears)
    const initialInvoiceId = openInvoice?.id;
    const initialInvoiceStatus = openInvoice?.status;
    setSuccessDetector(() => (current: BillingState) => {
      if (!initialInvoiceId) return false;
      const currentOpen = current.openInvoice;
      if (!currentOpen) return true;
      if (currentOpen.id !== initialInvoiceId) return true;
      if (currentOpen.status !== initialInvoiceStatus && currentOpen.status === 'CONFIRMED') return true;
      return false;
    });

    billingService.startInvoiceCheckout(invoiceId)
      .then((session) => {
        if (popupRef.current && !popupRef.current.closed) {
          try {
            popupRef.current.location.href = session.checkoutUrl;
          } catch {
            popupRef.current.location.replace(session.checkoutUrl);
          }
        }
      })
      .catch(() => {
        try { popupRef.current?.close(); } catch { /* cross-origin */ }
        resetPopupState();
        alert('Falha ao iniciar o pagamento. Tente novamente.');
      });
  };

  const removeCard = async () => {
    if (!confirm('Remover o cartão? As próximas cobranças virão como PIX.')) return;
    await billingService.removeCard();
    await refresh();
  };

  const cancelSub = async () => {
    await billingService.cancel();
    await refresh();
  };

  const regenerateOpenPix = async () => {
    if (!openInvoice) return;
    await billingService.regeneratePix(openInvoice.id);
    await refresh();
  };

  if (loading && !summary) return <div className="text-center py-4"><CSpinner size="sm" color="primary" /></div>;
  if (error || !summary) return <CAlert color="danger">Erro ao carregar dados de assinatura.</CAlert>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <BillingStatusCard summary={summary} />

      {openInvoice && (openInvoice.status === 'PENDING' || openInvoice.status === 'OVERDUE') && (
        <OpenInvoiceCard
          invoice={openInvoice}
          onPayWithCard={() => startInvoiceCheckout(openInvoice.id)}
          onRegeneratePix={regenerateOpenPix}
        />
      )}

      <PaymentMethodCard summary={summary} onAddCard={startCardCheckout} onRemoveCard={removeCard} />

      <Card header={<CardTitle title="Histórico de faturas" />}>
        <InvoiceHistoryTable invoices={history} />
      </Card>

      {!summary.canceledAt && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            onClick={() => setCancelOpen(true)}
            style={{
              background: 'transparent', border: 'none', color: '#5b6868',
              fontSize: 13, textDecoration: 'underline', cursor: 'pointer',
            }}
          >
            Cancelar assinatura
          </button>
        </div>
      )}

      <CancelSubscriptionDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={cancelSub} />

      <AsaasCheckoutPopup
        open={popupOpen}
        popupRef={popupRef}
        successDetector={successDetector}
        onClose={() => { resetPopupState(); }}
        onSuccess={() => { resetPopupState(); refresh(); }}
      />
    </div>
  );
}
