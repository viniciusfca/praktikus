import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CAlert, CButton, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilBasket,
  cilCart,
  cilCash,
  cilPlus,
  cilArrowRight,
  cilListRich,
} from '@coreui/icons';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuthStore } from '../../store/auth.store';
import { useDashboardSummary, usePurchasesByPeriod } from '../../hooks/recycling/useReports';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Period = '7d' | '30d' | '90d';

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 };

// ── Local primitives ────────────────────────────────────────────────────────

function Card({
  children,
  padding = 20,
}: {
  children: React.ReactNode;
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
      <div style={{ padding: typeof padding === 'number' ? padding : padding }}>{children}</div>
    </div>
  );
}

function CardHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '18px 20px 12px',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--cui-body-color)',
          }}
        >
          {title}
        </div>
        {desc && (
          <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
            {desc}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

function KpiCard({ label, value, sub, icon, tone = 'neutral' }: {
  label: string;
  value: string;
  sub?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CoreUI icon type is not exported
  icon: any;
  tone?: 'neutral' | 'primary' | 'success' | 'muted';
}) {
  const toneColors: Record<string, string> = {
    neutral: 'var(--cui-body-color)',
    primary: 'var(--cui-primary)',
    success: '#16a34a',
    muted: 'var(--cui-secondary-color)',
  };
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
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        <CIcon icon={icon} style={{ width: 13, height: 13 }} />
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: toneColors[tone],
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--cui-secondary-color)' }}>{sub}</div>
      )}
    </div>
  );
}

function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 3,
        gap: 2,
        background: 'var(--cui-card-cap-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 8,
      }}
    >
      {(['7d', '30d', '90d'] as const).map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            style={{
              padding: '4px 10px',
              border: 0,
              borderRadius: 6,
              background: active ? 'var(--cui-card-bg)' : 'transparent',
              color: active ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: active ? '0 1px 2px rgba(10,12,13,0.06)' : 'none',
              transition: 'all 0.12s',
            }}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function RecyclingDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firstName = (user?.name ?? 'por aí').split(' ')[0];

  const today = new Date();
  const greeting =
    today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateStr = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const { summary, loading, error } = useDashboardSummary();
  const { rows, loading: chartLoading, fetch } = usePurchasesByPeriod();
  const [period, setPeriod] = useState<Period>('30d');

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - PERIOD_DAYS[period]);
    fetch(toISODate(start), toISODate(end));
  }, [period, fetch]);

  const chartData = useMemo(() => {
    const labels = rows.map((r) =>
      new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    );
    const values = rows.map((r) => Number(r.total));
    return { labels, values };
  }, [rows]);

  const cashOpen = summary?.cashSession?.status === 'OPEN';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <CSpinner color="primary" />
      </div>
    );
  }

  if (error) {
    return <CAlert color="danger">{error}</CAlert>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Page head ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--cui-body-color)',
            }}
          >
            {greeting}, {firstName} 👋
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            Resumo da operação de recicláveis — {dateStr}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => navigate('/recycling/purchases/new')}
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <CIcon icon={cilBasket} size="sm" />
            Nova compra
          </CButton>
          <CButton
            color="primary"
            onClick={() => navigate('/recycling/sales/new')}
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <CIcon icon={cilPlus} size="sm" />
            Nova venda
          </CButton>
        </div>
      </div>

      {/* ── KPI grid ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <KpiCard
          label="Compras (hoje)"
          value={formatCurrency(summary?.totalPurchasedToday ?? 0)}
          sub={`${summary?.purchasesCountToday ?? 0} ${(summary?.purchasesCountToday ?? 0) === 1 ? 'operação' : 'operações'}`}
          icon={cilBasket}
          tone="neutral"
        />
        <KpiCard
          label="Caixa"
          value={cashOpen ? 'Aberto' : 'Fechado'}
          sub={
            cashOpen
              ? `Abertura: ${formatCurrency(summary?.cashSession?.openingBalance ?? 0)}`
              : 'Abra a sessão para operar'
          }
          icon={cilCash}
          tone={cashOpen ? 'success' : 'muted'}
        />
        <KpiCard
          label="Vendas (hoje)"
          value="—"
          sub="Métrica em breve"
          icon={cilCart}
          tone="muted"
        />
        <KpiCard
          label="Estoque"
          value="—"
          sub="Veja em Estoque"
          icon={cilListRich}
          tone="muted"
        />
      </div>

      {/* ── Chart + Caixa row ─────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 16,
        }}
        className="pk-dashboard-grid"
      >
        {/* Fluxo de compras */}
        <Card padding={0}>
          <CardHeader
            title="Fluxo de compras"
            desc={`últimos ${PERIOD_DAYS[period]} dias`}
            action={<PeriodTabs value={period} onChange={setPeriod} />}
          />
          <div style={{ padding: '0 20px 20px', height: 260, position: 'relative' }}>
            {chartLoading ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CSpinner size="sm" color="primary" />
              </div>
            ) : chartData.values.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'var(--cui-secondary-color)',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Sem compras no período</div>
                <div style={{ fontSize: 12 }}>Registre uma compra para ver o gráfico.</div>
              </div>
            ) : (
              <Line
                data={{
                  labels: chartData.labels,
                  datasets: [
                    {
                      label: 'Compras (R$)',
                      data: chartData.values,
                      borderColor: '#348E91',
                      backgroundColor: (ctx) => {
                        const chart = ctx.chart;
                        const { ctx: c, chartArea } = chart;
                        if (!chartArea) return 'rgba(52,142,145,0.15)';
                        const gradient = c.createLinearGradient(
                          0,
                          chartArea.top,
                          0,
                          chartArea.bottom,
                        );
                        gradient.addColorStop(0, 'rgba(52,142,145,0.32)');
                        gradient.addColorStop(1, 'rgba(52,142,145,0.02)');
                        return gradient;
                      },
                      fill: true,
                      tension: 0.35,
                      pointRadius: 0,
                      pointHoverRadius: 5,
                      pointHoverBackgroundColor: '#348E91',
                      pointHoverBorderColor: '#fff',
                      pointHoverBorderWidth: 2,
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { intersect: false, mode: 'index' },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#0A0C0D',
                      titleColor: '#fff',
                      bodyColor: '#e0e0e0',
                      padding: 10,
                      cornerRadius: 6,
                      displayColors: false,
                      callbacks: {
                        label: (ctx) => formatCurrency(Number(ctx.raw)),
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: {
                        color: 'var(--cui-secondary-color)',
                        font: { size: 10 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8,
                      },
                    },
                    y: {
                      grid: { color: 'var(--cui-border-color)' },
                      ticks: {
                        color: 'var(--cui-secondary-color)',
                        font: { size: 10 },
                        callback: (v) => `R$${(Number(v) / 1000).toFixed(0)}k`,
                      },
                      beginAtZero: true,
                    },
                  },
                }}
              />
            )}
          </div>
        </Card>

        {/* Caixa */}
        <Card padding={0}>
          <CardHeader title="Caixa" desc="Sessão atual" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--cui-secondary-color)' }}>Status</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: cashOpen ? '#16a34a' : 'var(--cui-secondary-color)',
                  background: cashOpen ? 'rgba(22,163,74,0.12)' : 'var(--cui-card-cap-bg)',
                  border: cashOpen ? 'none' : '1px solid var(--cui-border-color)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: cashOpen ? '#16a34a' : 'var(--cui-secondary-color)',
                  }}
                />
                {cashOpen ? 'Aberto' : 'Fechado'}
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--cui-secondary-color)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                {cashOpen ? 'Saldo de abertura' : 'Caixa inativo'}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--cui-body-color)',
                }}
              >
                {cashOpen
                  ? formatCurrency(summary?.cashSession?.openingBalance ?? 0)
                  : '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
                {cashOpen
                  ? 'Acesse o caixa para ver entradas e saídas do dia.'
                  : 'Abra uma sessão para começar a operar.'}
              </div>
            </div>

            <CButton
              color="primary"
              onClick={() => navigate('/recycling/cash-register')}
              style={{
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              Ir para o caixa <CIcon icon={cilArrowRight} size="sm" />
            </CButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
