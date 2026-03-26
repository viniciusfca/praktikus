import { CCard, CCardBody, CRow, CCol } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilNotes, cilCalendar, cilChartLine } from '@coreui/icons';

const summaryCards = [
  { label: 'OS Abertas', value: '—', icon: cilNotes },
  { label: 'Agendamentos Hoje', value: '—', icon: cilCalendar },
  { label: 'Faturamento do Mês', value: '—', icon: cilChartLine },
];

export function DashboardPage() {
  return (
    <>
      <h5 className="fw-bold mb-4">Dashboard</h5>
      <CRow className="g-3">
        {summaryCards.map((card) => (
          <CCol key={card.label} xs={12} sm={6} md={4}>
            <CCard>
              <CCardBody className="d-flex align-items-center gap-3">
                <CIcon icon={card.icon} size="3xl" className="text-primary" />
                <div>
                  <div className="fs-4 fw-bold">{card.value}</div>
                  <div className="text-secondary small">{card.label}</div>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>
    </>
  );
}
