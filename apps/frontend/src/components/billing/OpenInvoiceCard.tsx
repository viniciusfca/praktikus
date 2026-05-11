import { useState } from 'react';
import { CButton } from '@coreui/react';
import type { OpenInvoice } from '../../services/billing.service';

interface Props {
  invoice: OpenInvoice;
  onPayWithCard: () => void;   // abre popup Tipo 2
  onRegeneratePix: () => Promise<void>;
}

export function OpenInvoiceCard({ invoice, onPayWithCard, onRegeneratePix }: Props) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const formatBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const copy = async () => {
    if (!invoice.pix?.copyPaste) return;
    await navigator.clipboard.writeText(invoice.pix.copyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async () => {
    setRegenerating(true);
    try { await onRegeneratePix(); } finally { setRegenerating(false); }
  };

  const isOverdue = invoice.status === 'OVERDUE';

  return (
    <div
      style={{
        padding: 24,
        border: `2px solid ${isOverdue ? '#dc2626' : '#348E91'}`,
        borderRadius: 14,
        background: isOverdue ? 'rgba(220,38,38,0.04)' : 'rgba(52,142,145,0.04)',
      }}
    >
      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#5b6868', marginBottom: 4 }}>
        {isOverdue ? 'Fatura em atraso' : 'Fatura aberta'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{formatBRL(invoice.value)}</div>
        <div style={{ fontSize: 13, color: '#5b6868' }}>
          Vence {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
        </div>
      </div>

      {invoice.pix && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <img
            src={`data:image/png;base64,${invoice.pix.qrCodeBase64}`}
            alt="QR Code PIX"
            style={{ width: 180, height: 180, border: '1px solid #e3e7e7', borderRadius: 8 }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Pix Copia e Cola</div>
            <textarea
              readOnly
              value={invoice.pix.copyPaste}
              style={{
                width: '100%', minHeight: 100, fontFamily: 'monospace', fontSize: 11,
                padding: 8, borderRadius: 6, border: '1px solid #e3e7e7', resize: 'none',
              }}
              onFocus={(e) => e.target.select()}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <CButton color="primary" size="sm" onClick={copy}>
                {copied ? 'Copiado!' : 'Copiar código'}
              </CButton>
              <CButton color="secondary" variant="outline" size="sm" onClick={regenerate} disabled={regenerating}>
                {regenerating ? 'Atualizando…' : 'Atualizar QR'}
              </CButton>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #e3e7e7' }}>
        <CButton color="primary" variant="outline" onClick={onPayWithCard}>
          Pagar com cartão de crédito
        </CButton>
      </div>
    </div>
  );
}
