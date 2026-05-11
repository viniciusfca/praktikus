import { CButton } from '@coreui/react';
import type { BillingSummary } from '../../services/billing.service';

interface Props {
  readonly summary: BillingSummary;
  readonly hasOpenInvoice?: boolean;
  readonly onAddCard: () => void;       // abre popup checkout
  readonly onRemoveCard: () => void;
}

function CardContent({
  summary,
  hasOpenInvoice = false,
  onAddCard,
  onRemoveCard,
}: Props) {
  // When there's an open invoice, block payment method changes
  if (hasOpenInvoice) {
    if (summary.card) {
      return (
        <>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {summary.card.brand} •••• {summary.card.last4}
          </div>
          <div style={{ fontSize: 13, color: '#5b6868' }}>Vence {summary.card.expiry}</div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#92400e' }}>
            Pague a fatura aberta acima para gerenciar a forma de pagamento.
          </div>
        </>
      );
    }

    return (
      <>
        <div style={{ fontSize: 14, color: '#5b6868', marginBottom: 12 }}>
          Nenhuma forma de pagamento cadastrada.
        </div>
        <div style={{ fontSize: 12, color: '#92400e' }}>
          Pague a fatura aberta acima para gerenciar a forma de pagamento.
        </div>
      </>
    );
  }

  if (summary.card) {
    return (
      <>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {summary.card.brand} •••• {summary.card.last4}
        </div>
        <div style={{ fontSize: 13, color: '#5b6868' }}>Vence {summary.card.expiry}</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <CButton color="primary" variant="outline" size="sm" onClick={onAddCard}>
            Trocar cartão
          </CButton>
          <CButton color="danger" variant="ghost" size="sm" onClick={onRemoveCard}>
            Remover
          </CButton>
        </div>
      </>
    );
  }

  if (summary.billingType === 'PIX') {
    return (
      <>
        <div style={{ fontSize: 15, fontWeight: 600 }}>PIX a cada vencimento</div>
        <div style={{ fontSize: 13, color: '#5b6868' }}>
          Você paga manualmente cada fatura na aba acima.
        </div>
        <div style={{ marginTop: 12 }}>
          <CButton color="primary" variant="outline" size="sm" onClick={onAddCard}>
            Migrar para cartão
          </CButton>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ fontSize: 14, color: '#5b6868', marginBottom: 12 }}>
        Nenhuma forma de pagamento cadastrada.
      </div>
      <CButton color="primary" onClick={onAddCard}>
        Cadastrar forma de pagamento
      </CButton>
    </>
  );
}

export function PaymentMethodCard(props: Props) {
  return (
    <div style={{ padding: 18, border: '1px solid #e3e7e7', borderRadius: 12, background: '#fff' }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#5b6868', marginBottom: 8 }}>
        Forma de pagamento
      </div>
      <CardContent {...props} />
    </div>
  );
}
