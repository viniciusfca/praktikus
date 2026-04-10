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
import { useSales } from '../../../hooks/recycling/useSales';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SalesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { sales, total, loading, error } = useSales(page, limit);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Vendas</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/recycling/sales/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Nova Venda
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Comprador</CTableHeaderCell>
              <CTableHeaderCell>Observações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : sales.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-3 text-muted">
                  Nenhuma venda registrada.
                </CTableDataCell>
              </CTableRow>
            ) : sales.map((s) => (
              <CTableRow key={s.id}>
                <CTableDataCell>{formatDate(s.soldAt)}</CTableDataCell>
                <CTableDataCell>
                  <span title={s.buyerId} style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                    {s.buyerId.substring(0, 8)}...
                  </span>
                </CTableDataCell>
                <CTableDataCell>{s.notes ?? '—'}</CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCard>

      {total > limit && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <small className="text-muted">Total: {total}</small>
          <div className="d-flex gap-2">
            <CButton size="sm" color="secondary" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Anterior
            </CButton>
            <CButton size="sm" color="secondary" variant="outline" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>
              Próxima
            </CButton>
          </div>
        </div>
      )}
    </>
  );
}
