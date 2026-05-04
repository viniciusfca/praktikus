import { useState, useEffect, useCallback } from 'react';
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPen, cilPrint, cilRecycle } from '@coreui/icons';
import {
  productsService,
  type Product,
} from '../../../services/recycling/products.service';
import {
  unitsService,
  type Unit,
} from '../../../services/recycling/units.service';
import { usePriceTables } from '../../../hooks/recycling/usePriceTables';
import { ProductDialog } from '../../../components/recycling/ProductDialog';
import { PrintTableDialog } from '../../../components/recycling/PrintTableDialog';
import { companyService, type CompanyProfile } from '../../../services/company.service';
import { formatBRL } from '../../../utils/format';

// ── Main page ───────────────────────────────────────────────────────────────

export function ProductsPage() {
  const { priceTables, loading: ptLoading } = usePriceTables();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [empresa, setEmpresa] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const sortedTables = [...priceTables].sort((a, b) => a.sortOrder - b.sortOrder);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, unitsData, companyData] = await Promise.all([
        productsService.list(true),
        unitsService.list(),
        companyService.getProfile(),
      ]);
      setProducts(productsData);
      setUnits(unitsData);
      setEmpresa(companyData);
    } catch {
      setError('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSave = async (data: {
    name: string;
    unitId: string;
    active: boolean;
    prices: Record<string, number | null>;
  }) => {
    if (editing && editing !== 'new') {
      await productsService.update(editing.id, data);
    } else {
      await productsService.create({ ...data, prices: data.prices });
    }
    setEditing(null);
    await loadData();
  };

  const getUnitAbbreviation = (unitId: string): string => {
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.abbreviation : '—';
  };

  const activeCount = products.filter((p) => p.active).length;
  const isLoading = loading || ptLoading;

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
            Produtos
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {products.length > 0
              ? `${products.length} ${products.length === 1 ? 'produto' : 'produtos'}${activeCount < products.length ? ` · ${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}` : ''} · ${sortedTables.length} ${sortedTables.length === 1 ? 'tabela' : 'tabelas'} de preço`
              : 'Cadastre os materiais recicláveis que você opera'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setPrintOpen(true)}
            disabled={products.length === 0}
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <CIcon icon={cilPrint} size="sm" />
            Imprimir tabela
          </CButton>
          <CButton
            color="primary"
            onClick={() => setEditing('new')}
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <CIcon icon={cilPlus} size="sm" /> Novo produto
          </CButton>
        </div>
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Table card */}
      <CCard>
        <CCardBody style={{ padding: 0 }}>
          <CTable hover responsive className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Produto</CTableHeaderCell>
                <CTableHeaderCell>Unidade</CTableHeaderCell>
                {sortedTables.map((t) => (
                  <CTableHeaderCell
                    key={t.id}
                    style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                  >
                    {t.name}
                  </CTableHeaderCell>
                ))}
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {isLoading ? (
                <CTableRow>
                  <CTableDataCell colSpan={4 + sortedTables.length} className="text-center py-4">
                    <CSpinner size="sm" color="primary" />
                  </CTableDataCell>
                </CTableRow>
              ) : products.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={4 + sortedTables.length} className="text-center py-5">
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
                        <CIcon icon={cilRecycle} size="lg" style={{ color: 'var(--cui-primary)' }} />
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
                        Nenhum produto cadastrado
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                        Cadastre o primeiro material para começar.
                      </div>
                    </div>
                  </CTableDataCell>
                </CTableRow>
              ) : (
                products.map((p) => (
                  <CTableRow key={p.id}>
                    <CTableDataCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          aria-hidden
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'rgba(52,142,145,0.1)',
                            color: 'var(--cui-primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CIcon icon={cilRecycle} size="sm" />
                        </div>
                        <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{p.name}</span>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell
                      style={{
                        color: 'var(--cui-secondary-color)',
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {getUnitAbbreviation(p.unitId)}
                    </CTableDataCell>
                    {sortedTables.map((t) => (
                      <CTableDataCell
                        key={t.id}
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: 'var(--cui-body-color)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatBRL(p.prices[t.id])}
                      </CTableDataCell>
                    ))}
                    <CTableDataCell>
                      <CBadge color={p.active ? 'success' : 'secondary'}>
                        {p.active ? 'Ativo' : 'Inativo'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right' }}>
                      <CButton
                        color="secondary"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(p)}
                        title="Editar"
                        aria-label="Editar"
                      >
                        <CIcon icon={cilPen} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {editing !== null && sortedTables.length > 0 && (
        <ProductDialog
          key={editing === 'new' ? 'new' : editing.id}
          open={true}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          priceTables={sortedTables}
          units={units}
          product={editing === 'new' ? null : editing}
        />
      )}

      {printOpen && empresa && (
        <PrintTableDialog
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          priceTables={sortedTables}
          products={products}
          units={units}
          empresa={{ nomeFantasia: empresa.nomeFantasia, cnpj: empresa.cnpj }}
        />
      )}
    </div>
  );
}
