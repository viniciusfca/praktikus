import { useEffect, useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CSpinner, CAlert,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/react';
import { purchasesService, type PurchaseDetail } from '../../../services/recycling/purchases.service';

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDocument(doc: string | null, type: 'CPF' | 'CNPJ' | null): string | null {
  if (!doc) return null;
  if (type === 'CPF' && doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if ((type === 'CNPJ' || !type) && doc.length === 14) {
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
}

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CASH: { label: 'Dinheiro', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
  PIX: { label: 'PIX', color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.12)' },
  CARD: { label: 'Cartão', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
};

function PaymentBadge({ method }: { method: string }) {
  const c = PAYMENT_CONFIG[method] ?? PAYMENT_CONFIG.CARD;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: c.color,
        background: c.bg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11,
        color: 'var(--cui-secondary-color)',
        textTransform: 'uppercase',
        fontWeight: 600,
        letterSpacing: '0.04em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--cui-body-color)' }}>{value}</div>
    </div>
  );
}

export function PurchaseDetailModal({
  purchaseId,
  onClose,
}: {
  purchaseId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) { setDetail(null); return; }
    setLoading(true);
    setError(null);
    purchasesService.getById(purchaseId)
      .then(setDetail)
      .catch((e) => {
        if (e?.response?.status === 404) setError('Compra não encontrada.');
        else setError('Erro ao carregar compra.');
      })
      .finally(() => setLoading(false));
  }, [purchaseId]);

  const open = !!purchaseId;
  const shortId = detail ? `#${detail.id.slice(0, 8).toUpperCase()}` : '';

  return (
    <CModal visible={open} onClose={onClose} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Compra {shortId}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <CSpinner color="primary" />
          </div>
        )}
        {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}
        {detail && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}>
              <Field
                label="Fornecedor"
                value={
                  <>
                    <div>{detail.supplier.name || '—'}</div>
                    {detail.supplier.document && (
                      <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                        {formatDocument(detail.supplier.document, detail.supplier.documentType)}
                      </div>
                    )}
                  </>
                }
              />
              <Field
                label="Data/Hora"
                value={new Date(detail.purchasedAt).toLocaleString('pt-BR')}
              />
              <Field label="Operador" value={detail.operator.name || '—'} />
              <Field label="Pagamento" value={<PaymentBadge method={detail.paymentMethod} />} />
              <Field
                label="Total"
                value={
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--cui-primary)' }}>
                    {formatCurrency(detail.total)}
                  </span>
                }
              />
            </div>

            <div style={{ marginBottom: detail.notes ? 20 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Itens</div>
              <CTable small bordered className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Produto</CTableHeaderCell>
                    <CTableHeaderCell style={{ textAlign: 'right' }}>Qtd</CTableHeaderCell>
                    <CTableHeaderCell style={{ textAlign: 'right' }}>Preço/kg</CTableHeaderCell>
                    <CTableHeaderCell style={{ textAlign: 'right' }}>Subtotal</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {detail.items.map((it) => (
                    <CTableRow key={it.id}>
                      <CTableDataCell>{it.productName}</CTableDataCell>
                      <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {it.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg
                      </CTableDataCell>
                      <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(it.unitPrice)}
                      </CTableDataCell>
                      <CTableDataCell style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(it.subtotal)}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                  <CTableRow>
                    <CTableDataCell colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>Total</CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right', fontWeight: 700, color: 'var(--cui-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(detail.total)}
                    </CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
            </div>

            {detail.notes && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Observações</div>
                <div style={{
                  padding: 12,
                  background: 'var(--cui-card-cap-bg)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--cui-body-color)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {detail.notes}
                </div>
              </div>
            )}
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>Fechar</CButton>
      </CModalFooter>
    </CModal>
  );
}
