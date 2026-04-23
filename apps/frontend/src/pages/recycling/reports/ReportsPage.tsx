import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableFoot,
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
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { usePurchasesByPeriod } from '../../../hooks/recycling/useReports';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ── Schema ──────────────────────────────────────────────────────────────────
const periodSchema = z.object({
  startDate: z.string().min(1, 'Data inicial obrigatória'),
  endDate: z.string().min(1, 'Data final obrigatória'),
});

type PeriodForm = z.infer<typeof periodSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso + 'T00:00:00') : iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// Month chips — últimos 6 meses
const monthChips = (() => {
  const chips = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d
      .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      .replace('.', '');
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    chips.push({
      label,
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    });
  }
  return chips;
})();

// ── Primitives ──────────────────────────────────────────────────────────────

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
      {desc && (
        <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>{desc}</div>
      )}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

function getLast30Days(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

export function RecyclingReportsPage() {
  const defaults = getLast30Days();
  const { rows, loading, error, searched, fetch: fetchReport } = usePurchasesByPeriod();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PeriodForm>({
    resolver: zodResolver(periodSchema),
    defaultValues: defaults,
  });

  const currentStart = watch('startDate');
  const currentEnd = watch('endDate');

  // Auto-search on mount with default period
  useEffect(() => {
    fetchReport(defaults.startDate, defaults.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount
  }, []);

  const onSubmit = (data: PeriodForm) => {
    fetchReport(data.startDate, data.endDate);
  };

  const handleChipClick = (chip: { startDate: string; endDate: string }) => {
    setValue('startDate', chip.startDate);
    setValue('endDate', chip.endDate);
    fetchReport(chip.startDate, chip.endDate);
  };

  const activeChipIndex = monthChips.findIndex(
    (c) => c.startDate === currentStart && c.endDate === currentEnd,
  );

  const periodTotal = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const periodCount = rows.reduce((sum, r) => sum + r.count, 0);
  const averagePerDay = rows.length > 0 ? periodTotal / rows.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page head */}
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
          Relatórios
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
          Compras agregadas por período
        </p>
      </div>

      {/* Filter bar */}
      <div
        style={{
          background: 'var(--cui-card-bg)',
          border: '1px solid var(--cui-border-color)',
          borderRadius: 14,
          padding: 14,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
        }}
      >
        {/* Month chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {monthChips.map((chip, i) => {
            const active = activeChipIndex === i;
            return (
              <button
                key={chip.startDate}
                type="button"
                onClick={() => handleChipClick(chip)}
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

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}
        >
          <div>
            <CFormLabel
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--cui-secondary-color)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 4,
              }}
            >
              De
            </CFormLabel>
            <CFormInput
              type="date"
              size="sm"
              {...register('startDate')}
              invalid={!!errors.startDate}
              style={{ width: 150 }}
            />
            {errors.startDate && <CFormFeedback invalid>{errors.startDate.message}</CFormFeedback>}
          </div>
          <div>
            <CFormLabel
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--cui-secondary-color)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 4,
              }}
            >
              Até
            </CFormLabel>
            <CFormInput
              type="date"
              size="sm"
              {...register('endDate')}
              invalid={!!errors.endDate}
              style={{ width: 150 }}
            />
            {errors.endDate && <CFormFeedback invalid>{errors.endDate.message}</CFormFeedback>}
          </div>
          <CButton
            type="submit"
            color="primary"
            size="sm"
            disabled={loading}
            style={{ borderRadius: 8 }}
          >
            {loading ? <CSpinner size="sm" /> : 'Buscar'}
          </CButton>
        </form>
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <CSpinner color="primary" />
        </div>
      )}

      {searched && !loading && (
        <>
          {rows.length === 0 ? (
            <div
              style={{
                padding: 60,
                textAlign: 'center',
                border: '1px dashed var(--cui-border-color)',
                borderRadius: 14,
                background: 'var(--cui-card-cap-bg)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(52,142,145,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CIcon
                    icon={cilChartLine}
                    size="xl"
                    style={{ color: 'var(--cui-primary)' }}
                  />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Sem dados no período</div>
                <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                  Nenhuma compra encontrada entre {formatDateBR(currentStart)} e{' '}
                  {formatDateBR(currentEnd)}.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* KPIs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 14,
                }}
              >
                <KpiCard label="Total do período" value={formatCurrency(periodTotal)} />
                <KpiCard
                  label="Número de compras"
                  value={`${periodCount} ${periodCount === 1 ? 'compra' : 'compras'}`}
                />
                <KpiCard label="Média por dia com movimento" value={formatCurrency(averagePerDay)} />
              </div>

              {/* Chart */}
              <Card
                padding="0 20px 20px"
                header={
                  <CardTitle
                    title="Compras por dia"
                    desc={`${formatDateBR(currentStart)} a ${formatDateBR(currentEnd)}`}
                  />
                }
              >
                <div style={{ height: 280 }}>
                  <Bar
                    data={{
                      labels: rows.map((r) => formatDateShort(r.date)),
                      datasets: [
                        {
                          label: 'Compras (R$)',
                          data: rows.map((r) => Number(r.total)),
                          backgroundColor: '#348E91',
                          borderRadius: 3,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
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
                            maxTicksLimit: 10,
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
                </div>
              </Card>

              {/* Daily table */}
              <div className="pk-table-card">
                <div className="pk-table-toolbar">
                  <CardTitle
                    title="Detalhe diário"
                    desc="Valor total e número de compras por dia"
                  />
                </div>
                <CTable hover responsive className="mb-0">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Data</CTableHeaderCell>
                      <CTableHeaderCell style={{ textAlign: 'right' }}>Total</CTableHeaderCell>
                      <CTableHeaderCell style={{ textAlign: 'right' }}>Compras</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.map((r) => (
                      <CTableRow key={r.date}>
                        <CTableDataCell
                          style={{
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--cui-body-color)',
                          }}
                        >
                          {formatDateBR(r.date)}
                        </CTableDataCell>
                        <CTableDataCell
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                            color: 'var(--cui-body-color)',
                          }}
                        >
                          {formatCurrency(Number(r.total))}
                        </CTableDataCell>
                        <CTableDataCell
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--cui-secondary-color)',
                          }}
                        >
                          {r.count}
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                  <CTableFoot>
                    <CTableRow
                      style={{
                        background: 'var(--cui-card-cap-bg)',
                        borderTop: '2px solid var(--cui-border-color)',
                      }}
                    >
                      <CTableHeaderCell
                        style={{
                          fontSize: 12,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          fontWeight: 700,
                        }}
                      >
                        Total do período
                      </CTableHeaderCell>
                      <CTableHeaderCell
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 700,
                          color: 'var(--cui-primary)',
                        }}
                      >
                        {formatCurrency(periodTotal)}
                      </CTableHeaderCell>
                      <CTableHeaderCell
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 700,
                          color: 'var(--cui-primary)',
                        }}
                      >
                        {periodCount}
                      </CTableHeaderCell>
                    </CTableRow>
                  </CTableFoot>
                </CTable>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
