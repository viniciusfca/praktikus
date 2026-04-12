import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableFoot,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import { usePurchasesByPeriod } from '../../../hooks/recycling/useReports';

const periodSchema = z.object({
  startDate: z.string().min(1, 'Data inicial obrigatória'),
  endDate: z.string().min(1, 'Data final obrigatória'),
});

type PeriodForm = z.infer<typeof periodSchema>;

function getLast30Days(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso + 'T00:00:00') : iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function RecyclingReportsPage() {
  const defaults = getLast30Days();
  const { rows, loading, error, searched, fetch: fetchReport } = usePurchasesByPeriod();

  const { register, handleSubmit, formState: { errors } } = useForm<PeriodForm>({
    resolver: zodResolver(periodSchema),
    defaultValues: defaults,
  });

  const onSubmit = (data: PeriodForm) => {
    fetchReport(data.startDate, data.endDate);
  };

  const periodTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const periodCount = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
      <h5 className="fw-bold mb-4">Relatório de Compras por Período</h5>

      <CCard className="mb-4">
        <CCardHeader className="fw-semibold">Filtro</CCardHeader>
        <CCardBody>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CRow className="g-3 align-items-end">
              <CCol md={4}>
                <CFormLabel>Data Inicial</CFormLabel>
                <CFormInput type="date" {...register('startDate')} invalid={!!errors.startDate} />
                {errors.startDate && (
                  <small className="text-danger">{errors.startDate.message}</small>
                )}
              </CCol>
              <CCol md={4}>
                <CFormLabel>Data Final</CFormLabel>
                <CFormInput type="date" {...register('endDate')} invalid={!!errors.endDate} />
                {errors.endDate && (
                  <small className="text-danger">{errors.endDate.message}</small>
                )}
              </CCol>
              <CCol md={4}>
                <CButton type="submit" color="primary" disabled={loading}>
                  {loading ? <CSpinner size="sm" className="me-1" /> : null}
                  Consultar
                </CButton>
              </CCol>
            </CRow>
          </form>
        </CCardBody>
      </CCard>

      {error && <CAlert color="danger">{error}</CAlert>}

      {searched && (
        <CCard>
          <CCardHeader className="fw-semibold">Resultado</CCardHeader>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Data</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Total (R$)</CTableHeaderCell>
                <CTableHeaderCell className="text-end">N de Compras</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={3} className="text-center py-3 text-muted">
                    Nenhuma compra encontrada no período.
                  </CTableDataCell>
                </CTableRow>
              ) : (
                rows.map((r) => (
                  <CTableRow key={r.date}>
                    <CTableDataCell>{formatDate(r.date)}</CTableDataCell>
                    <CTableDataCell className="text-end">{formatCurrency(r.total)}</CTableDataCell>
                    <CTableDataCell className="text-end">{r.count}</CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
            {rows.length > 0 && (
              <CTableFoot>
                <CTableRow className="fw-bold">
                  <CTableHeaderCell>Total do Período</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">{formatCurrency(periodTotal)}</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">{periodCount}</CTableHeaderCell>
                </CTableRow>
              </CTableFoot>
            )}
          </CTable>
        </CCard>
      )}
    </>
  );
}
