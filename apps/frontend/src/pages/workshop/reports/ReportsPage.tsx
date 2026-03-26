import { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);
import axios from 'axios';
import { useAuthStore } from '../../../store/auth.store';
import { reportsApi, type ReportData } from '../../../services/reports.service';

const PIE_COLORS = ['#321fdb', '#9b59b6', '#fd7e14', '#1b9e3e', '#e55353', '#39f'];

const STATUS_LABEL: Record<string, string> = {
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const monthChips = (() => {
  const chips = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    chips.push({
      label,
      dateStart: `${year}-${month}-01`,
      dateEnd: `${year}-${month}-${lastDay}`,
    });
  }
  return chips;
})();

export function ReportsPage() {
  const user = useAuthStore((s) => s.user);

  const [dateStart, setDateStart] = useState(monthChips[0].dateStart);
  const [dateEnd, setDateEnd] = useState(monthChips[0].dateEnd);
  const [activeChip, setActiveChip] = useState(0);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (start = dateStart, end = dateEnd) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.get(start, end, controller.signal);
      setData(result);
    } catch (err) {
      if (axios.isCancel(err)) return;
      setError('Erro ao carregar relatório.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [dateStart, dateEnd]);

  if (user?.role !== 'OWNER') {
    return <Navigate to="/workshop/dashboard" replace />;
  }

  const handleChipClick = (index: number, chip: typeof monthChips[0]) => {
    setActiveChip(index);
    setDateStart(chip.dateStart);
    setDateEnd(chip.dateEnd);
    handleSearch(chip.dateStart, chip.dateEnd);
  };

  return (
    <>
      <h5 className="fw-bold mb-4">Relatórios</h5>

      {/* Month chips */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {monthChips.map((chip, i) => (
          <button
            key={chip.dateStart}
            type="button"
            className={`btn btn-sm ${activeChip === i ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => handleChipClick(i, chip)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Date range + search */}
      <CRow className="g-2 align-items-end mb-4">
        <CCol xs="auto">
          <CFormLabel className="mb-1">De</CFormLabel>
          <CFormInput
            type="date"
            size="sm"
            value={dateStart}
            onChange={(e) => { setDateStart(e.target.value); setActiveChip(-1); }}
          />
        </CCol>
        <CCol xs="auto">
          <CFormLabel className="mb-1">Até</CFormLabel>
          <CFormInput
            type="date"
            size="sm"
            value={dateEnd}
            onChange={(e) => { setDateEnd(e.target.value); setActiveChip(-1); }}
          />
        </CCol>
        <CCol xs="auto">
          <CButton color="primary" size="sm" onClick={() => handleSearch()} disabled={loading}>
            Buscar
          </CButton>
        </CCol>
      </CRow>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}
      {loading && (
        <div className="d-flex justify-content-center py-5">
          <CSpinner color="primary" />
        </div>
      )}

      {data && !loading && (
        <>
          {data.totalOs === 0 && (
            <p className="text-secondary mb-3">
              Nenhuma OS encontrada para o período selecionado.
            </p>
          )}

          {/* KPIs */}
          <CRow className="g-3 mb-4">
            {[
              { label: 'Faturamento Total', value: fmt(data.faturamentoTotal) },
              { label: 'Serviços', value: fmt(data.faturamentoServicos) },
              { label: 'Peças', value: fmt(data.faturamentoPecas) },
              { label: 'Total de OS', value: String(data.totalOs) },
              { label: 'OS Pagas', value: String(data.osPagas) },
            ].map((kpi) => (
              <CCol key={kpi.label} xs={6} md={4} lg="auto" style={{ flex: '1 1 150px' }}>
                <CCard>
                  <CCardBody className="py-3">
                    <div className="text-secondary small">{kpi.label}</div>
                    <div className="fs-5 fw-bold">{kpi.value}</div>
                  </CCardBody>
                </CCard>
              </CCol>
            ))}
          </CRow>

          {/* Charts */}
          {data.totalOs > 0 && (
            <CRow className="g-3 mb-4">
              <CCol xs={12} lg={8}>
                <CCard>
                  <CCardBody>
                    <div className="fw-semibold mb-3">Faturamento por Mês</div>
                    <Bar
                      data={{
                        labels: data.faturamentoPorMes.map((m) => m.mes),
                        datasets: [
                          {
                            label: 'Serviços',
                            backgroundColor: '#321fdb',
                            data: data.faturamentoPorMes.map((m) => m.servicos),
                            stack: 'a',
                          },
                          {
                            label: 'Peças',
                            backgroundColor: '#9b59b6',
                            data: data.faturamentoPorMes.map((m) => m.pecas),
                            stack: 'a',
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          tooltip: {
                            callbacks: {
                              label: (ctx) =>
                                `${ctx.dataset.label}: ${fmt(Number(ctx.raw))}`,
                            },
                          },
                        },
                        scales: {
                          y: {
                            stacked: true,
                            ticks: {
                              callback: (v) =>
                                `R$${(Number(v) / 1000).toFixed(0)}k`,
                            },
                          },
                          x: { stacked: true },
                        },
                        responsive: true,
                        maintainAspectRatio: true,
                      }}
                    />
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol xs={12} lg={4}>
                <CCard>
                  <CCardBody>
                    <div className="fw-semibold mb-3">OS por Status</div>
                    <Doughnut
                      data={{
                        labels: data.osPorStatus.map(
                          (s) => STATUS_LABEL[s.status] ?? s.status
                        ),
                        datasets: [
                          {
                            data: data.osPorStatus.map((s) => s.count),
                            backgroundColor: PIE_COLORS,
                            hoverOffset: 4,
                          },
                        ],
                      }}
                    />
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          )}

          {/* Top 10 services */}
          {data.topServicos.length > 0 && (
            <CCard>
              <CCardBody>
                <div className="fw-semibold mb-3">Top 10 Serviços</div>
                <CTable small bordered striped responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>#</CTableHeaderCell>
                      <CTableHeaderCell>Serviço</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Qtd</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Receita</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {data.topServicos.map((s, i) => (
                      <CTableRow key={i}>
                        <CTableDataCell>{i + 1}</CTableDataCell>
                        <CTableDataCell>{s.nomeServico}</CTableDataCell>
                        <CTableDataCell className="text-end">{s.quantidade}</CTableDataCell>
                        <CTableDataCell className="text-end">{fmt(s.receita)}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          )}
        </>
      )}
    </>
  );
}
