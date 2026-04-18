import { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CFormInput,
  CFormLabel,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilChartLine } from '@coreui/icons';
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
import axios from 'axios';
import { PageHead } from '../../../components/PageHead';
import { useAuthStore } from '../../../store/auth.store';
import { reportsApi, type ReportData } from '../../../services/reports.service';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// ── Palette — teal/petróleo aligned ─────────────────────────────────────────
const CHART_PALETTE = [
  '#348E91',  // teal primary
  '#1C5052',  // petróleo
  '#d97706',  // warning amber
  '#16a34a',  // success green
  '#6b7280',  // gray
  '#7fd0d2',  // teal light
];

const STATUS_LABEL: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em execução',
  AGUARDANDO_PECA: 'Aguard. peça',
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
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
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

// ── Sub-components ──────────────────────────────────────────────────────────

function Card({
  children,
  header,
  padding = 20,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  padding?: number | string;
}) {
  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {header && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--cui-border-color)' }}>
          {header}
        </div>
      )}
      <div style={{ padding: typeof padding === 'number' ? padding : padding }}>{children}</div>
    </div>
  );
}

function CardTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cui-body-color)' }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>{desc}</div>}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '18px 20px',
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--cui-secondary-color)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--cui-body-color)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
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
      <PageHead
        title="Relatórios"
        subtitle="Faturamento, distribuição de OS e serviços mais rentáveis"
      />

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--cui-card-bg)',
          border: '1px solid var(--cui-border-color)',
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
        }}
      >
        {/* Month chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {monthChips.map((chip, i) => {
            const active = activeChip === i;
            return (
              <button
                key={chip.dateStart}
                type="button"
                onClick={() => handleChipClick(i, chip)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: `1px solid ${active ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
                  background: active ? 'rgba(52,142,145,0.1)' : 'var(--cui-card-cap-bg)',
                  color: active ? 'var(--cui-primary)' : 'var(--cui-body-color)',
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.12s',
                  textTransform: 'capitalize',
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--cui-border-color)' }} />

        {/* Custom date range */}
        <div>
          <CFormLabel style={{ fontSize: 11, fontWeight: 600, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            De
          </CFormLabel>
          <CFormInput
            type="date"
            size="sm"
            value={dateStart}
            onChange={(e) => { setDateStart(e.target.value); setActiveChip(-1); }}
            style={{ width: 150 }}
          />
        </div>
        <div>
          <CFormLabel style={{ fontSize: 11, fontWeight: 600, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            Até
          </CFormLabel>
          <CFormInput
            type="date"
            size="sm"
            value={dateEnd}
            onChange={(e) => { setDateEnd(e.target.value); setActiveChip(-1); }}
            style={{ width: 150 }}
          />
        </div>
        <CButton
          color="primary"
          size="sm"
          onClick={() => handleSearch()}
          disabled={loading}
          style={{ borderRadius: 8 }}
        >
          {loading ? <CSpinner size="sm" /> : 'Buscar'}
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <CSpinner color="primary" />
        </div>
      )}

      {data && !loading && (
        <>
          {data.totalOs === 0 ? (
            <div
              style={{
                padding: 60,
                textAlign: 'center',
                border: '1px dashed var(--cui-border-color)',
                borderRadius: 14,
                background: 'var(--cui-card-cap-bg)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(52,142,145,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CIcon icon={cilChartLine} size="xl" style={{ color: 'var(--cui-primary)' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Sem dados para o período</div>
                <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                  Nenhuma OS encontrada entre {dateStart} e {dateEnd}.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* ── KPI grid ───────────────────────────────────────── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 14,
                }}
              >
                <KpiCard label="Faturamento total" value={fmt(data.faturamentoTotal)} />
                <KpiCard label="Serviços" value={fmt(data.faturamentoServicos)} />
                <KpiCard label="Peças" value={fmt(data.faturamentoPecas)} />
                <KpiCard label="Total de OS" value={String(data.totalOs)} />
                <KpiCard label="OS pagas" value={String(data.osPagas)} />
              </div>

              {/* ── Charts row ─────────────────────────────────────── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
                  gap: 16,
                }}
                className="pk-dashboard-grid"
              >
                {/* Faturamento por mês */}
                <Card
                  padding="0 20px 20px"
                  header={<CardTitle title="Faturamento por mês" desc="Serviços vs peças — período selecionado" />}
                >
                  <div style={{ height: 280 }}>
                    <Bar
                      data={{
                        labels: data.faturamentoPorMes.map((m) => m.mes),
                        datasets: [
                          {
                            label: 'Serviços',
                            backgroundColor: '#348E91',
                            borderRadius: 3,
                            data: data.faturamentoPorMes.map((m) => m.servicos),
                            stack: 'a',
                          },
                          {
                            label: 'Peças',
                            backgroundColor: '#1C5052',
                            borderRadius: 3,
                            data: data.faturamentoPorMes.map((m) => m.pecas),
                            stack: 'a',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top',
                            align: 'start',
                            labels: {
                              boxWidth: 10,
                              boxHeight: 10,
                              padding: 14,
                              font: { size: 12, weight: 500 },
                              usePointStyle: true,
                              pointStyle: 'rectRounded',
                            },
                          },
                          tooltip: {
                            backgroundColor: '#0A0C0D',
                            titleColor: '#fff',
                            bodyColor: '#e0e0e0',
                            padding: 10,
                            cornerRadius: 6,
                            callbacks: {
                              label: (ctx) =>
                                `${ctx.dataset.label}: ${fmt(Number(ctx.raw))}`,
                            },
                          },
                        },
                        scales: {
                          y: {
                            stacked: true,
                            grid: { color: 'var(--cui-border-color)' },
                            ticks: {
                              color: 'var(--cui-secondary-color)',
                              font: { size: 10 },
                              callback: (v) => `R$${(Number(v) / 1000).toFixed(0)}k`,
                            },
                          },
                          x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: {
                              color: 'var(--cui-secondary-color)',
                              font: { size: 10 },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </Card>

                {/* OS por Status */}
                <Card
                  padding="0 20px 20px"
                  header={<CardTitle title="OS por status" desc="Distribuição das ordens" />}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: '100%', maxWidth: 220, aspectRatio: '1 / 1' }}>
                      <Doughnut
                        data={{
                          labels: data.osPorStatus.map((s) => STATUS_LABEL[s.status] ?? s.status),
                          datasets: [
                            {
                              data: data.osPorStatus.map((s) => s.count),
                              backgroundColor: CHART_PALETTE,
                              borderWidth: 0,
                              hoverOffset: 4,
                            },
                          ],
                        }}
                        options={{
                          cutout: '70%',
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              backgroundColor: '#0A0C0D',
                              titleColor: '#fff',
                              bodyColor: '#e0e0e0',
                              padding: 10,
                              cornerRadius: 6,
                            },
                          },
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', width: '100%' }}>
                      {data.osPorStatus.map((s, i) => (
                        <div
                          key={s.status}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: CHART_PALETTE[i % CHART_PALETTE.length],
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: 'var(--cui-secondary-color)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {STATUS_LABEL[s.status] ?? s.status}
                          </span>
                          <b style={{ fontWeight: 700, color: 'var(--cui-body-color)' }}>{s.count}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>

              {/* ── Top 10 services ────────────────────────────────── */}
              {data.topServicos.length > 0 && (
                <div className="pk-table-card">
                  <div className="pk-table-toolbar">
                    <CardTitle title="Top 10 serviços" desc="Serviços mais rentáveis no período" />
                  </div>
                  <CTable hover responsive className="mb-0">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell style={{ width: 48 }}>#</CTableHeaderCell>
                        <CTableHeaderCell>Serviço</CTableHeaderCell>
                        <CTableHeaderCell style={{ textAlign: 'right' }}>Qtd</CTableHeaderCell>
                        <CTableHeaderCell style={{ textAlign: 'right' }}>Receita</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {data.topServicos.map((s, i) => (
                        <CTableRow key={i}>
                          <CTableDataCell>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                background: i < 3 ? 'rgba(52,142,145,0.12)' : 'var(--cui-card-cap-bg)',
                                color: i < 3 ? 'var(--cui-primary)' : 'var(--cui-secondary-color)',
                                fontSize: 11.5,
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {i + 1}
                            </span>
                          </CTableDataCell>
                          <CTableDataCell style={{ fontWeight: 500 }}>{s.nomeServico}</CTableDataCell>
                          <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--cui-secondary-color)' }}>
                            {s.quantidade}
                          </CTableDataCell>
                          <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            {fmt(s.receita)}
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
