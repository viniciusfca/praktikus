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
import { cilPlus, cilSearch, cilCart } from '@coreui/icons';
import { useSales } from '../../../hooks/recycling/useSales';
import { buyersService, type Buyer } from '../../../services/recycling/buyers.service';

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

// ── Main page ───────────────────────────────────────────────────────────────
export function SalesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;
  const { sales, total, loading, error } = useSales(page, limit);

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [search, setSearch] = useState('');

  // Load buyers once for name lookup
  useEffect(() => {
    buyersService
      .list(1, 200)
      .then((res) => setBuyers(res.data))
      .catch(() => setBuyers([]));
  }, []);

  const buyerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of buyers) map.set(b.id, b.name);
    return map;
  }, [buyers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const buyerName = (buyerMap.get(s.buyerId) ?? '').toLowerCase();
      const hay = `${s.id} ${buyerName} ${s.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sales, search, buyerMap]);

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
            Vendas
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {total > 0
              ? `${total} ${total === 1 ? 'venda registrada' : 'vendas registradas'}`
              : 'Registre saídas de material para compradores'}
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

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Table card */}
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
              placeholder="Buscar por ID, comprador ou observação..."
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
              <CTableHeaderCell>Observações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : filtered.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-5">
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
              filtered.map((s) => {
                const buyerName = buyerMap.get(s.buyerId);
                return (
                  <CTableRow key={s.id}>
                    <CTableDataCell
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color: 'var(--cui-body-color)',
                        fontWeight: 600,
                      }}
                    >
                      #{s.id.slice(0, 8).toUpperCase()}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--cui-body-color)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatDate(s.soldAt)}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--cui-secondary-color)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatTime(s.soldAt)}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {buyerName ? (
                        <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>
                          {buyerName}
                        </span>
                      ) : (
                        <span
                          style={{
                            color: 'var(--cui-secondary-color)',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12,
                          }}
                        >
                          {s.buyerId.slice(0, 8)}…
                        </span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell
                      style={{
                        fontSize: 13,
                        color: s.notes ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                        maxWidth: 360,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.notes ?? '—'}
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
