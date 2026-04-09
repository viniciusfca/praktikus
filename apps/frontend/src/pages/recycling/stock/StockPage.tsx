import { useState } from 'react';
import {
  CAlert,
  CBadge,
  CCard,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import { useStock, useProductMovements } from '../../../hooks/recycling/useStock';
import { StockBalance } from '../../../services/recycling/stock.service';

function MovementTypeLabel({ type }: { type: string }) {
  return (
    <CBadge color={type === 'IN' ? 'success' : 'danger'}>
      {type === 'IN' ? 'Entrada' : 'Saída'}
    </CBadge>
  );
}

function MovementsPanel({ productId }: { productId: string }) {
  const { movements, loading, error } = useProductMovements(productId);

  if (loading) {
    return (
      <div className="text-center py-3">
        <CSpinner size="sm" />
      </div>
    );
  }

  if (error) {
    return <CAlert color="danger" className="m-2">{error}</CAlert>;
  }

  if (movements.length === 0) {
    return <p className="text-muted text-center py-3 mb-0">Nenhuma movimentação registrada.</p>;
  }

  return (
    <CTable small hover responsive className="mb-0">
      <CTableHead color="light">
        <CTableRow>
          <CTableHeaderCell>Tipo</CTableHeaderCell>
          <CTableHeaderCell>Quantidade</CTableHeaderCell>
          <CTableHeaderCell>Referência</CTableHeaderCell>
          <CTableHeaderCell>Data/Hora</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {movements.map((m) => (
          <CTableRow key={m.id}>
            <CTableDataCell><MovementTypeLabel type={m.type} /></CTableDataCell>
            <CTableDataCell>{m.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CTableDataCell>
            <CTableDataCell>{m.referenceType ?? '—'}</CTableDataCell>
            <CTableDataCell>
              {new Date(m.movedAt).toLocaleString('pt-BR')}
            </CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  );
}

export function StockPage() {
  const { balances, loading, error, reload } = useStock();
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const handleRowClick = (product: StockBalance) => {
    setExpandedProductId((prev) => (prev === product.productId ? null : product.productId));
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Estoque</h5>
      </div>

      {error && (
        <CAlert color="danger" className="mb-3" dismissible onClose={reload}>
          {error}
        </CAlert>
      )}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Produto</CTableHeaderCell>
              <CTableHeaderCell>Unidade</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Saldo Atual</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : balances.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-3 text-muted">
                  Nenhum produto cadastrado.
                </CTableDataCell>
              </CTableRow>
            ) : (
              balances.map((b) => (
                <>
                  <CTableRow
                    key={b.productId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(b)}
                  >
                    <CTableDataCell>{b.productName}</CTableDataCell>
                    <CTableDataCell>{b.unitAbbreviation}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      <CBadge color={b.balance > 0 ? 'success' : 'warning'}>
                        {b.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </CBadge>
                    </CTableDataCell>
                  </CTableRow>
                  {expandedProductId === b.productId && (
                    <CTableRow key={`${b.productId}-movements`}>
                      <CTableDataCell colSpan={3} className="p-0 bg-light">
                        <MovementsPanel productId={b.productId} />
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </>
              ))
            )}
          </CTableBody>
        </CTable>
      </CCard>
    </>
  );
}
