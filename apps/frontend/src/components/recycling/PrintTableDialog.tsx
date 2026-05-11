import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormSwitch,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCloudDownload, cilSettings, cilFile } from '@coreui/icons';
import type { PriceTable } from '@praktikus/shared';
import type { Product } from '../../services/recycling/products.service';
import { usePrintTableForm } from '../../hooks/recycling/usePrintTableForm';
import { downloadPdf } from '../../utils/downloadPdf';
import { PriceListPdf } from './PriceListPdf';
import { formatBRL } from '../../utils/format';

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export interface PrintTableDialogProps {
  open: boolean;
  onClose: () => void;
  priceTables: PriceTable[];
  products: Product[];
  units: Array<{ id: string; abbreviation: string }>;
  empresa: { nomeFantasia: string; cnpj: string };
}

export function PrintTableDialog({
  open,
  onClose,
  priceTables,
  products,
  units,
  empresa,
}: PrintTableDialogProps) {
  const {
    tableId,
    setTableId,
    layout,
    setLayout,
    includeInactive,
    setIncludeInactive,
    selectedTable,
    filteredProducts,
    canDownload,
  } = usePrintTableForm(priceTables, products);

  const sortedTables = [...priceTables].sort((a, b) => a.sortOrder - b.sortOrder);
  const visiblePreview = filteredProducts.slice(0, 8);
  const overflow = filteredProducts.length - visiblePreview.length;

  const handleDownload = async () => {
    if (!selectedTable) return;
    const rows = filteredProducts.map((p) => {
      const unit = units.find((u) => u.id === p.unitId);
      return {
        name: p.name,
        unitSymbol: unit?.abbreviation ?? '',
        pricePerUnit: p.prices[selectedTable.id] ?? 0,
      };
    });
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10);
    await downloadPdf(
      <PriceListPdf
        rows={rows}
        empresa={empresa}
        printedAt={date}
        table={{ name: selectedTable.name }}
        layout={layout}
      />,
      `tabela-precos-${slug(selectedTable.name)}-${dateStr}.pdf`,
    );
  };

  return (
    <CModal visible={open} onClose={onClose} size="lg">
      <CModalHeader>
        <CModalTitle>Imprimir tabela de preços</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
          Escolha qual tabela será impressa e ajuste o que aparece no documento.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            marginTop: 12,
          }}
        >
          {/* Configurações */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionLabel icon={cilSettings}>Configurações</SectionLabel>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cui-secondary-color)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Tabela de preço *
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sortedTables.map((t) => (
                  <label
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      border: `1px solid ${
                        tableId === t.id
                          ? 'var(--cui-primary)'
                          : 'var(--cui-border-color)'
                      }`,
                      borderRadius: 6,
                      background:
                        tableId === t.id
                          ? 'var(--cui-primary-bg-subtle, rgba(50,108,114,0.08))'
                          : 'var(--cui-body-bg)',
                    }}
                  >
                    <input
                      type="radio"
                      name="ptable"
                      checked={tableId === t.id}
                      onChange={() => setTableId(t.id)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 540 }}>{t.name}</span>
                      {t.description && (
                        <span style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                          {t.description}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cui-secondary-color)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Layout
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <CButton
                  variant={layout === 'full' ? undefined : 'outline'}
                  color="primary"
                  size="sm"
                  onClick={() => setLayout('full')}
                >
                  Completo
                </CButton>
                <CButton
                  variant={layout === 'compact' ? undefined : 'outline'}
                  color="primary"
                  size="sm"
                  onClick={() => setLayout('compact')}
                >
                  Compacto
                </CButton>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                border: '1px solid var(--cui-border-color)',
                borderRadius: 6,
                background: 'var(--cui-tertiary-bg)',
                cursor: 'pointer',
              }}
            >
              <CFormSwitch
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 540 }}>
                  Incluir produtos inativos
                </span>
                <span style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                  Por padrão, apenas ativos.
                </span>
              </div>
            </label>
          </section>

          {/* Pré-visualização */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <SectionLabel icon={cilFile}>Pré-visualização</SectionLabel>
            <div
              style={{
                background: '#fff',
                color: '#0F1414',
                border: '1px solid var(--cui-border-color)',
                borderRadius: 6,
                padding: 16,
                fontSize: 11,
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingBottom: 10,
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{empresa.nomeFantasia}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>
                    {selectedTable?.name}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'right' }}>
                  Emitida em
                  <br />
                  {new Date().toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: 12,
                    padding: '20px 4px',
                    textAlign: 'center',
                  }}
                >
                  Nenhum produto com preço nesta tabela. Cadastre preços em{' '}
                  {selectedTable?.name} primeiro.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '6px 4px' }}>Produto</th>
                      {layout === 'full' && (
                        <th style={{ textAlign: 'left', padding: '6px 4px' }}>Un.</th>
                      )}
                      <th style={{ textAlign: 'right', padding: '6px 4px' }}>
                        Preço{layout === 'full' ? ' por unidade' : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePreview.map((p) => {
                      const u = units.find((x) => x.id === p.unitId);
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px 4px' }}>{p.name}</td>
                          {layout === 'full' && (
                            <td style={{ padding: '6px 4px', color: '#6b7280' }}>
                              {u?.abbreviation ?? ''}
                            </td>
                          )}
                          <td
                            style={{
                              padding: '6px 4px',
                              textAlign: 'right',
                              fontFeatureSettings: "'tnum'",
                              fontWeight: 600,
                            }}
                          >
                            {formatBRL(p.prices[selectedTable?.id ?? ''])}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {overflow > 0 && (
                <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
                  + {overflow} outros produtos
                </div>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--cui-secondary-color)' }}>
              {filteredProducts.length} produto(s) com preço definido nesta tabela.
            </p>
          </section>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton variant="ghost" onClick={onClose}>
          Cancelar
        </CButton>
        <CButton color="primary" onClick={handleDownload} disabled={!canDownload}>
          <CIcon icon={cilCloudDownload} size="sm" style={{ marginRight: 6 }} />
          Baixar PDF
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon?: string[];
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--cui-secondary-color)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {icon && <CIcon icon={icon} size="sm" />}
      {children}
    </div>
  );
}
