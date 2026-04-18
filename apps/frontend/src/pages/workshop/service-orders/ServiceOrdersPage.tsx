import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
import { cilPlus, cilSearch, cilCloudDownload, cilNotes } from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import { SoStatusBadge, PaymentBadge } from '../../../components/SoStatusBadge';
import { serviceOrdersApi, type ServiceOrder, type SoStatus } from '../../../services/service-orders.service';
import { CreateServiceOrderDialog } from './CreateServiceOrderDialog';

type FilterValue = 'all' | SoStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'ORCAMENTO', label: 'Orçamento' },
  { value: 'APROVADO', label: 'Aprovadas' },
  { value: 'EM_EXECUCAO', label: 'Em execução' },
  { value: 'AGUARDANDO_PECA', label: 'Aguard. peça' },
  { value: 'FINALIZADA', label: 'Finalizadas' },
  { value: 'ENTREGUE', label: 'Entregues' },
];

export function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await serviceOrdersApi.list();
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (q) {
        const hay = `${o.id} ${o.kmEntrada ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filter, search]);

  const pendingCount = orders.filter((o) => o.status === 'ORCAMENTO').length;

  return (
    <>
      <PageHead
        title="Ordens de Serviço"
        subtitle={
          orders.length > 0
            ? `${orders.length} ${orders.length === 1 ? 'ordem' : 'ordens'}${pendingCount > 0 ? ` · ${pendingCount} em orçamento` : ''}`
            : 'Gerencie as OS da sua oficina'
        }
        actions={
          <>
            <CButton color="secondary" variant="outline" style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CIcon icon={cilCloudDownload} size="sm" /> Exportar
            </CButton>
            <CButton color="primary" onClick={() => setCreateOpen(true)} style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CIcon icon={cilPlus} size="sm" /> Nova OS
            </CButton>
          </>
        }
      />

      <div className="pk-table-card">
        <div className="pk-table-toolbar" style={{ flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
            <CIcon
              icon={cilSearch}
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--cui-secondary-color)', pointerEvents: 'none', width: 14, height: 14,
              }}
            />
            <CFormInput
              placeholder="Buscar por nº, cliente, placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar OS"
            />
          </div>

          {/* Pill filter tabs */}
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
            {FILTERS.map((f) => {
              const active = filter === f.value;
              const count =
                f.value === 'all' ? orders.length : orders.filter((o) => o.status === f.value).length;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 7,
                    border: 0,
                    background: active ? 'var(--cui-card-bg)' : 'transparent',
                    color: active ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    boxShadow: active ? '0 1px 2px rgba(10,12,13,0.06)' : 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
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
              <CTableHeaderCell>OS</CTableHeaderCell>
              <CTableHeaderCell>Criada em</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
              <CTableHeaderCell>Pagamento</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>KM entrada</CTableHeaderCell>
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
                      <CIcon icon={cilNotes} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>Nenhuma OS encontrada</div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {search || filter !== 'all' ? 'Tente ajustar os filtros.' : 'Crie a primeira OS para começar.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : filtered.map((so) => (
              <CTableRow
                key={so.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/workshop/service-orders/${so.id}`)}
              >
                <CTableDataCell>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--cui-body-color)' }}>
                    #OS-{so.id.slice(0, 8).toUpperCase()}
                  </div>
                </CTableDataCell>
                <CTableDataCell style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>
                  {new Date(so.createdAt).toLocaleDateString('pt-BR')}
                </CTableDataCell>
                <CTableDataCell>
                  <SoStatusBadge status={so.status} />
                </CTableDataCell>
                <CTableDataCell>
                  <PaymentBadge status={so.statusPagamento} />
                </CTableDataCell>
                <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--cui-secondary-color)' }}>
                  {so.kmEntrada ?? '—'}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>

      <CreateServiceOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={load}
      />
    </>
  );
}
