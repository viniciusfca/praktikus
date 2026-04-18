import { useEffect, useMemo, useState } from 'react';
import {
  CAlert,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilRecycle, cilLayers, cilWarning, cilListRich } from '@coreui/icons';
import { useStock, useProductMovements } from '../../../hooks/recycling/useStock';
import { productsService, type Product } from '../../../services/recycling/products.service';
import type { StockBalance } from '../../../services/recycling/stock.service';

// ── Formatters ──────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatQty(value: number, unit: string): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${unit}`;
}

// ── Primitives ──────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent,
  icon,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CoreUI icon type
  icon: any;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--cui-card-cap-bg)',
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CIcon icon={icon} size="lg" />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--cui-secondary-color)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--cui-body-color)',
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Material Card ───────────────────────────────────────────────────────────

function MaterialCard({
  balance,
  price,
  maxBalance,
  selected,
  onClick,
}: {
  balance: StockBalance;
  price: number;
  maxBalance: number;
  selected: boolean;
  onClick: () => void;
}) {
  const value = balance.balance * price;
  const pct = maxBalance > 0 ? (balance.balance / maxBalance) * 100 : 0;
  const empty = balance.balance === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'var(--cui-card-bg)',
        border: `1px solid ${selected ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
        boxShadow: selected ? '0 0 0 3px rgba(52,142,145,0.15)' : 'none',
        borderRadius: 14,
        padding: 18,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s ease, box-shadow 0.2s ease, transform 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(52,142,145,0.35)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cui-border-color)';
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'rgba(52, 142, 145, 0.1)',
            color: 'var(--cui-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CIcon icon={cilRecycle} size="lg" />
        </div>
        {empty && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              color: '#b45309',
              background: 'rgba(217, 119, 6, 0.12)',
            }}
          >
            <CIcon icon={cilWarning} size="sm" />
            Sem estoque
          </span>
        )}
      </div>

      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--cui-body-color)', letterSpacing: '-0.01em' }}>
        {balance.productName}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
        {formatCurrency(price)} / {balance.unitAbbreviation}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginTop: 14,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--cui-body-color)',
          }}
        >
          {balance.balance.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
        </span>
        <span style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
          {balance.unitAbbreviation}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--cui-body-color)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatCurrency(value)}
        </span>
      </div>

      {/* Relative progress bar (vs max balance in list) */}
      <div
        style={{
          height: 5,
          background: 'var(--cui-card-cap-bg)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: empty ? '#d97706' : 'var(--cui-primary)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </button>
  );
}

// ── Movements Panel ─────────────────────────────────────────────────────────

const REFERENCE_LABELS: Record<string, string> = {
  PURCHASE: 'Compra',
  SALE: 'Venda',
  ADJUSTMENT: 'Ajuste',
};

function MovementsPanel({ product }: { product: StockBalance }) {
  const { movements, loading, error } = useProductMovements(product.productId);

  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--cui-border-color)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cui-body-color)' }}>
          Movimentações · {product.productName}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
          Histórico de entradas e saídas deste material
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <CSpinner size="sm" color="primary" />
        </div>
      ) : error ? (
        <div style={{ padding: 20 }}>
          <CAlert color="danger" className="mb-0">{error}</CAlert>
        </div>
      ) : movements.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--cui-secondary-color)',
            fontSize: 13,
          }}
        >
          Nenhuma movimentação registrada.
        </div>
      ) : (
        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Tipo</CTableHeaderCell>
              <CTableHeaderCell>Referência</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Quantidade</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Data/Hora</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {movements.map((m) => {
              const isIn = m.type === 'IN';
              return (
                <CTableRow key={m.id}>
                  <CTableDataCell>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: isIn ? '#15803d' : '#b91c1c',
                        background: isIn ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isIn ? '#16a34a' : '#dc2626',
                        }}
                      />
                      {isIn ? 'Entrada' : 'Saída'}
                    </span>
                  </CTableDataCell>
                  <CTableDataCell
                    style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}
                  >
                    {m.referenceType ? REFERENCE_LABELS[m.referenceType] ?? m.referenceType : '—'}
                  </CTableDataCell>
                  <CTableDataCell
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      color: isIn ? '#15803d' : '#b91c1c',
                    }}
                  >
                    {isIn ? '+ ' : '− '}
                    {formatQty(m.quantity, product.unitAbbreviation)}
                  </CTableDataCell>
                  <CTableDataCell
                    style={{
                      textAlign: 'right',
                      fontSize: 12,
                      color: 'var(--cui-secondary-color)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {new Date(m.movedAt).toLocaleString('pt-BR')}
                  </CTableDataCell>
                </CTableRow>
              );
            })}
          </CTableBody>
        </CTable>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function StockPage() {
  const { balances, loading, error, reload } = useStock();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    productsService.list().then(setProducts).catch(() => setProducts([]));
  }, []);

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.id, Number(p.pricePerUnit));
    return map;
  }, [products]);

  const totals = useMemo(() => {
    let totalValue = 0;
    let totalQty = 0;
    let emptyCount = 0;
    for (const b of balances) {
      const price = priceMap.get(b.productId) ?? 0;
      totalValue += b.balance * price;
      totalQty += b.balance;
      if (b.balance === 0) emptyCount += 1;
    }
    return { totalValue, totalQty, emptyCount };
  }, [balances, priceMap]);

  const maxBalance = useMemo(
    () => balances.reduce((m, b) => Math.max(m, b.balance), 0),
    [balances],
  );

  const selected = selectedId ? balances.find((b) => b.productId === selectedId) ?? null : null;

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
          Estoque
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
          Saldo atual de cada material. Clique em um card para ver movimentações.
        </p>
      </div>

      {error && (
        <CAlert color="danger" className="mb-0" dismissible onClose={reload}>
          {error}
        </CAlert>
      )}

      {/* 3 SummaryCards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <SummaryCard
          label="Valor em estoque"
          value={formatCurrency(totals.totalValue)}
          accent="var(--cui-primary)"
          icon={cilLayers}
          sub="soma de (saldo × preço)"
        />
        <SummaryCard
          label="Materiais"
          value={`${balances.length} ${balances.length === 1 ? 'tipo' : 'tipos'}`}
          accent="var(--cui-primary)"
          icon={cilListRich}
          sub={
            balances.length > 0
              ? `${totals.totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} unidades no total`
              : 'sem produtos cadastrados'
          }
        />
        <SummaryCard
          label="Sem estoque"
          value={`${totals.emptyCount} ${totals.emptyCount === 1 ? 'alerta' : 'alertas'}`}
          accent={totals.emptyCount > 0 ? '#d97706' : '#16a34a'}
          icon={cilWarning}
          sub={totals.emptyCount > 0 ? 'exige reposição' : 'todos com saldo'}
        />
      </div>

      {/* Material cards grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <CSpinner color="primary" />
        </div>
      ) : balances.length === 0 ? (
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
              <CIcon icon={cilRecycle} size="xl" style={{ color: 'var(--cui-primary)' }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Estoque vazio</div>
            <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
              Cadastre produtos e registre compras para ver o saldo aqui.
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {balances.map((b) => (
            <MaterialCard
              key={b.productId}
              balance={b}
              price={priceMap.get(b.productId) ?? 0}
              maxBalance={maxBalance}
              selected={selectedId === b.productId}
              onClick={() =>
                setSelectedId((prev) => (prev === b.productId ? null : b.productId))
              }
            />
          ))}
        </div>
      )}

      {/* Movements panel (when a card is selected) */}
      {selected && <MovementsPanel product={selected} />}
    </div>
  );
}
