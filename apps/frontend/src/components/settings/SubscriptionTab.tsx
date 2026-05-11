import { useEffect, useState } from 'react';
import { CAlert, CSpinner } from '@coreui/react';
import { Card, CardTitle } from './Card';
import { useBillingStore } from '../../store/billing.store';
import { billingService } from '../../services/billing.service';
import { BillingStatusCard } from '../billing/BillingStatusCard';
import { PaymentMethodCard } from '../billing/PaymentMethodCard';
import { OpenInvoiceCard } from '../billing/OpenInvoiceCard';
import { InvoiceHistoryTable } from '../billing/InvoiceHistoryTable';
import { CancelSubscriptionDialog } from '../billing/CancelSubscriptionDialog';
import { AsaasCheckoutPopup } from '../billing/AsaasCheckoutPopup';

export function SubscriptionTab() {
  const { summary, openInvoice, history, loading, error, refresh, popupOpen, setPopupOpen } = useBillingStore();
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => { refresh(); }, [refresh]);

  // SINCRONO em onClick (sem await): abre popup imediatamente, faz request em background
  const startCardCheckout = () => {
    setPopupOpen(true);
    billingService.startCardCheckout()
      .then((s) => setCheckoutUrl(s.checkoutUrl))
      .catch(() => { setPopupOpen(false); alert('Falha ao iniciar o checkout. Tente novamente.'); });
  };

  const startInvoiceCheckout = (invoiceId: string) => {
    setPopupOpen(true);
    billingService.startInvoiceCheckout(invoiceId)
      .then((s) => setCheckoutUrl(s.checkoutUrl))
      .catch(() => { setPopupOpen(false); alert('Falha ao iniciar o pagamento. Tente novamente.'); });
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
        checkoutUrl={checkoutUrl}
        onClose={() => { setPopupOpen(false); setCheckoutUrl(null); }}
        onSuccess={() => { setPopupOpen(false); setCheckoutUrl(null); refresh(); }}
      />
    </div>
  );
}
