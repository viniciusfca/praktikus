import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CCard,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus } from '@coreui/icons';
import { usePurchases } from '../../../hooks/recycling/usePurchases';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CARD: 'Cartão',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PurchasesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;
  const { purchases, total, loading, error } = usePurchases(page, limit);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Compras</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/recycling/purchases/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Nova Compra
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Fornecedor</CTableHeaderCell>
              <CTableHeaderCell>Forma de Pagamento</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Total (R$)</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : purchases.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-3 text-muted">
                  Nenhuma compra registrada.
                </CTableDataCell>
              </CTableRow>
            ) : purchases.map((p) => (
              <CTableRow key={p.id}>
                <CTableDataCell>{formatDate(p.purchasedAt)}</CTableDataCell>
                <CTableDataCell className="text-monospace" style={{ fontFamily: 'monospace' }}>
                  {p.supplierId.slice(0, 8)}…
                </CTableDataCell>
                <CTableDataCell>{PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</CTableDataCell>
                <CTableDataCell className="text-end">{formatCurrency(p.totalAmount)}</CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCard>

      {total > limit && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <small className="text-muted">Total: {total}</small>
          <div className="d-flex gap-2">
            <CButton
              size="sm"
              color="secondary"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </CButton>
            <CButton
              size="sm"
              color="secondary"
              variant="outline"
              disabled={page * limit >= total}
              onClick={() => setPage(page + 1)}
            >
              Proxima
            </CButton>
          </div>
        </div>
      )}
    </>
  );
}
