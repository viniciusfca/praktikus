import { useEffect, useMemo, useState } from 'react';
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
import { cilPlus, cilSearch, cilBasket } from '@coreui/icons';
import { usePurchases } from '../../../hooks/recycling/usePurchases';
import { suppliersService, type Supplier } from '../../../services/recycling/suppliers.service';

// ── Constants ───────────────────────────────────────────────────────────────
type PaymentFilter = 'all' | 'CASH' | 'PIX' | 'CARD';

const PAYMENT_FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CARD', label: 'Cartão' },
];

// ── Formatters ──────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── PaymentBadge ────────────────────────────────────────────────────────────
function PaymentBadge({ method }: { method: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    CASH: { label: 'Dinheiro', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
    PIX: { label: 'PIX', color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.12)' },
    CARD: { label: 'Cartão', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
  };
  const c = config[method] ?? config.CARD;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: c.color,
        background: c.bg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export function PurchasesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;
  const { purchases, total, loading, error } = usePurchases(page, limit);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');

  // Load suppliers once for name lookup (first 200 — suficiente pra operações reais)
  useEffect(() => {
    suppliersService
      .list(1, 200)
      .then((res) => setSuppliers(res.data))
      .catch(() => setSuppliers([]));
  }, []);

  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of suppliers) map.set(s.id, s.name);
    return map;
  }, [suppliers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchases.filter((p) => {
      if (paymentFilter !== 'all' && p.paymentMethod !== paymentFilter) return false;
      if (q) {
        const supplierName = (supplierMap.get(p.supplierId) ?? '').toLowerCase();
        const hay = `${p.id} ${supplierName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [purchases, paymentFilter, search, supplierMap]);

  const totalPages = Math.ceil(total / limit) || 1;
  const shownFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const shownTo = Math.min(page * limit, total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page head */}
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
            Compras
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {total > 0
              ? `${total} ${total === 1 ? 'compra registrada' : 'compras registradas'}`
              : 'Registre entradas de material comprado de fornecedores'}
          </p>
        </div>
        <CButton
          color="primary"
          onClick={() => navigate('/recycling/purchases/new')}
          style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <CIcon icon={cilPlus} size="sm" /> Nova compra
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Table card */}
      <div className="pk-table-card">
        <div className="pk-table-toolbar" style={{ flexWrap: 'wrap' }}>
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
              placeholder="Buscar por ID ou fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar compras"
            />
          </div>

          {/* Payment filter pills */}
          <div
            style={{
              display: 'inline-flex',
              gap: 2,
              padding: 3,
              background: 'var(--cui-card-cap-bg)',
              border: '1px solid var(--cui-border-color)',
              borderRadius: 10,
              flexWrap: 'wrap',
            }}
          >
            {PAYMENT_FILTERS.map((f) => {
              const active = paymentFilter === f.value;
              const count =
                f.value === 'all'
                  ? purchases.length
                  : purchases.filter((p) => p.paymentMethod === f.value).length;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setPaymentFilter(f.value)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    border: 0,
                    borderRadius: 7,
                    background: active ? 'var(--cui-card-bg)' : 'transparent',
                    color: active ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: active ? '0 1px 2px rgba(10,12,13,0.06)' : 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '1px 5px',
                        borderRadius: 999,
                        fontWeight: 700,
                        background: active ? 'rgba(52,142,145,0.12)' : 'rgba(107,114,128,0.12)',
                        color: active ? 'var(--cui-primary)' : 'var(--cui-secondary-color)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>ID</CTableHeaderCell>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Fornecedor</CTableHeaderCell>
              <CTableHeaderCell>Pagamento</CTableHeaderCell>
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
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'rgba(52,142,145,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CIcon icon={cilBasket} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
                      {purchases.length === 0 ? 'Nenhuma compra ainda' : 'Nenhum resultado'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {purchases.length === 0
                        ? 'Registre a primeira compra para começar.'
                        : 'Tente ajustar a busca ou o filtro.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : (
              filtered.map((p) => {
                const supplierName = supplierMap.get(p.supplierId);
                return (
                  <CTableRow key={p.id}>
                    <CTableDataCell
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color: 'var(--cui-body-color)',
                        fontWeight: 600,
                      }}
                    >
                      #{p.id.slice(0, 8).toUpperCase()}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--cui-body-color)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatDate(p.purchasedAt)}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--cui-secondary-color)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatTime(p.purchasedAt)}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {supplierName ? (
                        <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>
                          {supplierName}
                        </span>
                      ) : (
                        <span
                          style={{
                            color: 'var(--cui-secondary-color)',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12,
                          }}
                        >
                          {p.supplierId.slice(0, 8)}…
                        </span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      <PaymentBadge method={p.paymentMethod} />
                    </CTableDataCell>
                    <CTableDataCell
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: 'var(--cui-body-color)',
                      }}
                    >
                      {formatCurrency(p.totalAmount)}
                    </CTableDataCell>
                  </CTableRow>
                );
              })
            )}
          </CTableBody>
        </CTable>

        <div className="pk-table-footer">
          <span>
            {total > 0 ? `Mostrando ${shownFrom}–${shownTo} de ${total}` : 'Nenhum registro'}
          </span>
          {total > limit && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                aria-label="Página anterior"
              >
                ‹
              </CButton>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  fontWeight: 500,
                  color: 'var(--cui-body-color)',
                }}
              >
                {page} / {totalPages}
              </span>
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                aria-label="Próxima página"
              >
                ›
              </CButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
