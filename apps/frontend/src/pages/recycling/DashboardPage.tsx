import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
} from '@coreui/react';
import { useDashboardSummary } from '../../hooks/recycling/useReports';

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function RecyclingDashboardPage() {
  const navigate = useNavigate();
  const { summary, loading, error } = useDashboardSummary();

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner />
      </div>
    );
  }

  if (error) {
    return <CAlert color="danger">{error}</CAlert>;
  }

  return (
    <>
      <h5 className="fw-bold mb-4">Dashboard — Reciclagem</h5>

      <CRow className="g-3 mb-4">
        <CCol md={4}>
          <CCard className="h-100">
            <CCardHeader className="fw-semibold">Compras Hoje</CCardHeader>
            <CCardBody>
              <div className="fs-4 fw-bold text-primary">
                {formatCurrency(summary?.totalPurchasedToday ?? 0)}
              </div>
              <small className="text-muted">
                {summary?.purchasesCountToday ?? 0} compra(s) registrada(s)
              </small>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={4}>
          <CCard className="h-100">
            <CCardHeader className="fw-semibold">Caixa</CCardHeader>
            <CCardBody>
              {summary?.cashSession ? (
                <>
                  <div className="mb-2">
                    <CBadge color="success">ABERTO</CBadge>
                  </div>
                  <small className="text-muted d-block mb-3">
                    Saldo inicial: {formatCurrency(summary.cashSession.openingBalance)}
                  </small>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <CBadge color="danger">FECHADO</CBadge>
                  </div>
                </>
              )}
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                onClick={() => navigate('/recycling/cash-register')}
              >
                Ir para Caixa
              </CButton>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={4}>
          <CCard className="h-100">
            <CCardHeader className="fw-semibold">Ações Rápidas</CCardHeader>
            <CCardBody className="d-flex flex-column gap-2">
              <CButton
                color="primary"
                size="sm"
                onClick={() => navigate('/recycling/purchases/new')}
              >
                Nova Compra
              </CButton>
              <CButton
                color="success"
                size="sm"
                onClick={() => navigate('/recycling/sales/new')}
              >
                Nova Venda
              </CButton>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
}
