import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CFormInput,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilSearch, cilCart, cilArrowTop } from '@coreui/icons';
import { useSales } from '../../../hooks/recycling/useSales';
import { useSalesSummary } from '../../../hooks/recycling/useReports';
import { SaleDetailModal } from './SaleDetailModal';

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('pt-BR')}kg`;
}

function materialSummary(item: { itemCount: number; firstProductName: string | null; totalKg: number }): string {
  if (item.itemCount === 0) return '—';
  if (item.itemCount === 1 && item.firstProductName) {
    return `${item.firstProductName} · ${formatKg(item.totalKg)}`;
  }
  return `${item.itemCount} materiais · ${formatKg(item.totalKg)}`;
}

// ── KPI Card (inline, matches dashboard style) ──────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  loading: boolean;
}) {
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
        <CIcon icon={cilArrowTop} style={{ width: 13, height: 13 }} />
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--cui-body-color)',
        }}
      >
        {loading ? '—' : value}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--cui-secondary-color)' }}>
        {sub}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export function SalesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;
  const { sales, total, loading, error } = useSales(page, limit);
  const { summary, loading: summaryLoading } = useSalesSummary();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const hay = `${s.id} ${s.buyerName} ${s.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sales, search]);

  const totalPages = Math.ceil(total / limit) || 1;
  const shownFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const shownTo = Math.min(page * limit, total);

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
            Vendas
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {total > 0
              ? `${total} ${total === 1 ? 'venda registrada' : 'vendas registradas'}`
              : 'Registre saídas de material vendido para compradores.'}
          </p>
        </div>
        <CButton
          color="primary"
          onClick={() => navigate('/recycling/sales/new')}
          style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <CIcon icon={cilPlus} size="sm" /> Nova venda
        </CButton>
      </div>

      {/* ── KPI grid ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <KpiCard
          label="Hoje"
          value={formatCurrency(summary?.today.total ?? 0)}
          sub={`${summary?.today.count ?? 0} ${(summary?.today.count ?? 0) === 1 ? 'venda' : 'vendas'}`}
          loading={summaryLoading}
        />
        <KpiCard
          label="Semana"
          value={formatCurrency(summary?.week.total ?? 0)}
          sub={`${summary?.week.count ?? 0} ${(summary?.week.count ?? 0) === 1 ? 'venda' : 'vendas'}`}
          loading={summaryLoading}
        />
        <KpiCard
          label="Mês"
          value={formatCurrency(summary?.month.total ?? 0)}
          sub={`${summary?.month.count ?? 0} ${(summary?.month.count ?? 0) === 1 ? 'venda' : 'vendas'}`}
          loading={summaryLoading}
        />
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* ── Table card ───────────────────────────────────────────── */}
      <div className="pk-table-card">
        <div className="pk-table-toolbar">
          <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
            <CIcon
              icon={cilSearch}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--cui-secondary-color)',
                pointerEvents: 'none',
                width: 14,
                height: 14,
              }}
            />
            <CFormInput
              placeholder="Buscar por comprador, material ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar vendas"
            />
          </div>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>ID</CTableHeaderCell>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Comprador</CTableHeaderCell>
              <CTableHeaderCell>Material</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Total</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : filtered.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center py-5">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'rgba(52,142,145,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CIcon icon={cilCart} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
                      {sales.length === 0 ? 'Nenhuma venda ainda' : 'Nenhum resultado'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {sales.length === 0
                        ? 'Registre a primeira venda para começar.'
                        : 'Tente ajustar a busca.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : (
              filtered.map((s) => (
                <CTableRow
                  key={s.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedId(s.id)}
                >
                  <CTableDataCell style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: 'var(--cui-body-color)',
                    fontWeight: 600,
                  }}>
                    #{s.id.slice(0, 8).toUpperCase()}
                  </CTableDataCell>
                  <CTableDataCell>
                    <div style={{ fontSize: 13, color: 'var(--cui-body-color)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDate(s.soldAt)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--cui-secondary-color)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTime(s.soldAt)}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>
                    {s.buyerName ? (
                      <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{s.buyerName}</span>
                    ) : (
                      <span style={{ color: 'var(--cui-secondary-color)' }}>—</span>
                    )}
                  </CTableDataCell>
                  <CTableDataCell>
                    <span style={{ fontSize: 13, color: 'var(--cui-body-color)' }}>
                      {materialSummary(s)}
                    </span>
                  </CTableDataCell>
                  <CTableDataCell style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--cui-primary)',
                  }}>
                    {formatCurrency(s.total)}
                  </CTableDataCell>
                </CTableRow>
              ))
            )}
          </CTableBody>
        </CTable>

        <div className="pk-table-footer">
          <span>{total > 0 ? `Mostrando ${shownFrom}–${shownTo} de ${total}` : 'Nenhum registro'}</span>
          {total > limit && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <CButton color="secondary" variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Página anterior">‹</CButton>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', fontWeight: 500, color: 'var(--cui-body-color)' }}>{page} / {totalPages}</span>
              <CButton color="secondary" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Próxima página">›</CButton>
            </div>
          )}
        </div>
      </div>

      <SaleDetailModal saleId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
