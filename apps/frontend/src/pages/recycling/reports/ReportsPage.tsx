import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CNav,
  CNavItem,
  CNavLink,
  CSpinner,
  CTabContent,
  CTabPane,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableFoot,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilBasket, cilCart, cilChartLine, cilListRich } from '@coreui/icons';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  usePurchasesByPeriod,
  useSalesByPeriod,
  useTopMaterialsRanking,
} from '../../../hooks/recycling/useReports';

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

function formatKg(value: number): string {
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
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
      yearMonth: `${year}-${month}`,
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

function getLast30Days(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

function EmptyState({ message }: { message: string }) {
  return (
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
        <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>{message}</div>
      </div>
    </div>
  );
}

// ── Period filter (shared) ──────────────────────────────────────────────────

interface PeriodFilterProps {
  onSearch: (startDate: string, endDate: string) => void;
  loading: boolean;
}

function PeriodFilter({ onSearch, loading }: PeriodFilterProps) {
  const defaults = getLast30Days();
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

  const onSubmit = (data: PeriodForm) => {
    onSearch(data.startDate, data.endDate);
  };

  const handleChipClick = (chip: { startDate: string; endDate: string }) => {
    setValue('startDate', chip.startDate);
    setValue('endDate', chip.endDate);
    onSearch(chip.startDate, chip.endDate);
  };

  const activeChipIndex = monthChips.findIndex(
    (c) => c.startDate === currentStart && c.endDate === currentEnd,
  );

  return (
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
  );
}

// ── Period report (shared by Compras / Vendas tabs) ─────────────────────────

interface PeriodReportRow {
  date: string;
  total: number;
  count: number;
}

interface PeriodReportTabProps {
  rows: PeriodReportRow[];
  loading: boolean;
  error: string | null;
  searched: boolean;
  onSearch: (startDate: string, endDate: string) => void;
  labels: {
    chartTitle: string;
    chartSeries: string;
    detailTitle: string;
    countSingular: string;
    countPlural: string;
    emptyMessage: (start: string, end: string) => string;
  };
  chartColor: string;
}

function PeriodReportTab({
  rows,
  loading,
  error,
  searched,
  onSearch,
  labels,
  chartColor,
}: PeriodReportTabProps) {
  const defaults = getLast30Days();
  const [currentStart, setCurrentStart] = useState(defaults.startDate);
  const [currentEnd, setCurrentEnd] = useState(defaults.endDate);

  // Auto-search on mount
  useEffect(() => {
    onSearch(defaults.startDate, defaults.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount
  }, []);

  const handleSearch = (startDate: string, endDate: string) => {
    setCurrentStart(startDate);
    setCurrentEnd(endDate);
    onSearch(startDate, endDate);
  };

  const periodTotal = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const periodCount = rows.reduce((sum, r) => sum + r.count, 0);
  const averagePerDay = rows.length > 0 ? periodTotal / rows.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PeriodFilter onSearch={handleSearch} loading={loading} />

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <CSpinner color="primary" />
        </div>
      )}

      {searched && !loading && rows.length === 0 && (
        <EmptyState message={labels.emptyMessage(currentStart, currentEnd)} />
      )}

      {searched && !loading && rows.length > 0 && (
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
              label={`Número de ${labels.countPlural}`}
              value={`${periodCount} ${periodCount === 1 ? labels.countSingular : labels.countPlural}`}
            />
            <KpiCard label="Média por dia com movimento" value={formatCurrency(averagePerDay)} />
          </div>

          {/* Chart */}
          <Card
            padding="0 20px 20px"
            header={
              <CardTitle
                title={labels.chartTitle}
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
                      label: labels.chartSeries,
                      data: rows.map((r) => Number(r.total)),
                      backgroundColor: chartColor,
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
                title={labels.detailTitle}
                desc={`Valor total e número de ${labels.countPlural} por dia`}
              />
            </div>
            <CTable hover responsive className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Data</CTableHeaderCell>
                  <CTableHeaderCell style={{ textAlign: 'right' }}>Total</CTableHeaderCell>
                  <CTableHeaderCell style={{ textAlign: 'right' }}>
                    {labels.countPlural[0].toUpperCase() + labels.countPlural.slice(1)}
                  </CTableHeaderCell>
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
    </div>
  );
}

// ── Compras tab ─────────────────────────────────────────────────────────────

function PurchasesTab() {
  const { rows, loading, error, searched, fetch: fetchReport } = usePurchasesByPeriod();

  return (
    <PeriodReportTab
      rows={rows}
      loading={loading}
      error={error}
      searched={searched}
      onSearch={fetchReport}
      labels={{
        chartTitle: 'Compras por dia',
        chartSeries: 'Compras (R$)',
        detailTitle: 'Detalhe diário',
        countSingular: 'compra',
        countPlural: 'compras',
        emptyMessage: (s, e) =>
          `Nenhuma compra encontrada entre ${formatDateBR(s)} e ${formatDateBR(e)}.`,
      }}
      chartColor="#348E91"
    />
  );
}

// ── Vendas tab ──────────────────────────────────────────────────────────────

function SalesTab() {
  const { rows, loading, error, searched, fetch: fetchReport } = useSalesByPeriod();

  return (
    <PeriodReportTab
      rows={rows}
      loading={loading}
      error={error}
      searched={searched}
      onSearch={fetchReport}
      labels={{
        chartTitle: 'Vendas por dia',
        chartSeries: 'Vendas (R$)',
        detailTitle: 'Detalhe diário',
        countSingular: 'venda',
        countPlural: 'vendas',
        emptyMessage: (s, e) =>
          `Nenhuma venda encontrada entre ${formatDateBR(s)} e ${formatDateBR(e)}.`,
      }}
      chartColor="#16a34a"
    />
  );
}

// ── Top Materiais tab ───────────────────────────────────────────────────────

function TopMaterialsTab() {
  const currentMonthDefault = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthDefault);
  const { rows, loading, error, searched } = useTopMaterialsRanking(selectedMonth, 10);

  const totalQty = rows.reduce((sum, r) => sum + Number(r.totalQty), 0);
  const totalValue = rows.reduce((sum, r) => sum + Number(r.totalValue), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Month filter */}
      <div
        style={{
          background: 'var(--cui-card-bg)',
          border: '1px solid var(--cui-border-color)',
          borderRadius: 14,
          padding: 14,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--cui-secondary-color)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginRight: 6,
          }}
        >
          Mês
        </span>
        {monthChips.map((chip) => {
          const active = chip.yearMonth === selectedMonth;
          return (
            <button
              key={chip.yearMonth}
              type="button"
              onClick={() => setSelectedMonth(chip.yearMonth)}
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

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <CSpinner color="primary" />
        </div>
      )}

      {searched && !loading && rows.length === 0 && (
        <EmptyState
          message={`Nenhuma compra registrada no mês selecionado.`}
        />
      )}

      {searched && !loading && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            <KpiCard label="Materiais distintos" value={String(rows.length)} />
            <KpiCard label="Volume total comprado" value={formatKg(totalQty)} />
            <KpiCard label="Valor total comprado" value={formatCurrency(totalValue)} />
          </div>

          {/* Ranking table */}
          <div className="pk-table-card">
            <div className="pk-table-toolbar">
              <CardTitle
                title="Ranking de materiais"
                desc="Ordenado por volume total comprado no mês"
              />
            </div>
            <CTable hover responsive className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 60 }}>#</CTableHeaderCell>
                  <CTableHeaderCell>Material</CTableHeaderCell>
                  <CTableHeaderCell style={{ textAlign: 'right' }}>Volume</CTableHeaderCell>
                  <CTableHeaderCell style={{ textAlign: 'right' }}>Valor total</CTableHeaderCell>
                  <CTableHeaderCell style={{ textAlign: 'right' }}>Compras</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.map((r, i) => (
                  <CTableRow key={r.productId}>
                    <CTableDataCell
                      style={{
                        fontWeight: 700,
                        color: 'var(--cui-secondary-color)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {i + 1}
                    </CTableDataCell>
                    <CTableDataCell
                      style={{ color: 'var(--cui-body-color)', fontWeight: 600 }}
                    >
                      {r.productName}
                    </CTableDataCell>
                    <CTableDataCell
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: 'var(--cui-body-color)',
                      }}
                    >
                      {formatKg(Number(r.totalQty))}
                    </CTableDataCell>
                    <CTableDataCell
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--cui-body-color)',
                      }}
                    >
                      {formatCurrency(Number(r.totalValue))}
                    </CTableDataCell>
                    <CTableDataCell
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--cui-secondary-color)',
                      }}
                    >
                      {r.purchaseCount}
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
                  <CTableHeaderCell />
                  <CTableHeaderCell
                    style={{
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontWeight: 700,
                    }}
                  >
                    Total
                  </CTableHeaderCell>
                  <CTableHeaderCell
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      color: 'var(--cui-primary)',
                    }}
                  >
                    {formatKg(totalQty)}
                  </CTableHeaderCell>
                  <CTableHeaderCell
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      color: 'var(--cui-primary)',
                    }}
                  >
                    {formatCurrency(totalValue)}
                  </CTableHeaderCell>
                  <CTableHeaderCell />
                </CTableRow>
              </CTableFoot>
            </CTable>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Compras', icon: cilBasket },
  { label: 'Vendas', icon: cilCart },
  { label: 'Top Materiais', icon: cilListRich },
];

export function RecyclingReportsPage() {
  const [activeTab, setActiveTab] = useState(0);

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
          Compras, vendas e ranking de materiais
        </p>
      </div>

      <div style={{ borderBottom: '1px solid var(--cui-border-color)' }}>
        <CNav variant="tabs" className="pk-tabs" style={{ border: 0 }}>
          {TABS.map((t, i) => (
            <CNavItem key={t.label}>
              <CNavLink
                active={activeTab === i}
                onClick={() => setActiveTab(i)}
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CIcon icon={t.icon} size="sm" /> {t.label}
              </CNavLink>
            </CNavItem>
          ))}
        </CNav>
      </div>

      <CTabContent>
        <CTabPane visible={activeTab === 0}>{activeTab === 0 && <PurchasesTab />}</CTabPane>
        <CTabPane visible={activeTab === 1}>{activeTab === 1 && <SalesTab />}</CTabPane>
        <CTabPane visible={activeTab === 2}>{activeTab === 2 && <TopMaterialsTab />}</CTabPane>
      </CTabContent>
    </div>
  );
}
