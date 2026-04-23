import { useEffect, useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CSpinner, CAlert,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/react';
import { salesService, type SaleDetail } from '../../../services/recycling/sales.service';
import { SalePdf } from '../../../components/recycling/SalePdf';
import { downloadPdf } from '../../../utils/downloadPdf';
import { companyService } from '../../../services/company.service';

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

export function SaleDetailModal({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!detail) return;
    setPrinting(true);
    setError(null);
    try {
      let nomeFantasia = 'Praktikus';
      try {
        const company = await companyService.getProfile();
        nomeFantasia = company.nomeFantasia;
      } catch {
        /* fallback to 'Praktikus' */
      }
      await downloadPdf(
        <SalePdf sale={detail} empresa={{ nomeFantasia }} />,
        `Venda-${detail.id.slice(0, 8).toUpperCase()}.pdf`,
      );
    } catch {
      setError('Erro ao gerar PDF.');
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    if (!saleId) { setDetail(null); return; }
    setLoading(true);
    setError(null);
    salesService.getById(saleId)
      .then(setDetail)
      .catch((e) => {
        if (e?.response?.status === 404) setError('Venda não encontrada.');
        else setError('Erro ao carregar venda.');
      })
      .finally(() => setLoading(false));
  }, [saleId]);

  const open = !!saleId;
  const shortId = detail ? `#${detail.id.slice(0, 8).toUpperCase()}` : '';

  return (
    <CModal visible={open} onClose={onClose} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Venda {shortId}</CModalTitle>
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
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}>
              <Field
                label="Comprador"
                value={
                  <>
                    <div>{detail.buyer.name || '—'}</div>
                    {detail.buyer.document && (
                      <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                        {formatDocument(detail.buyer.document, detail.buyer.documentType)}
                      </div>
                    )}
                  </>
                }
              />
              <Field
                label="Data/Hora"
                value={new Date(detail.soldAt).toLocaleString('pt-BR')}
              />
              <Field label="Operador" value={detail.operator.name || '—'} />
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
        <CButton
          color="primary"
          variant="outline"
          onClick={handlePrint}
          disabled={!detail || printing}
          style={{ marginRight: 'auto', minWidth: 130 }}
        >
          {printing ? <CSpinner size="sm" /> : 'Imprimir PDF'}
        </CButton>
        <CButton color="secondary" variant="outline" onClick={onClose}>Fechar</CButton>
      </CModalFooter>
    </CModal>
  );
}
