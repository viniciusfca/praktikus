import { useState, useEffect, useCallback } from 'react';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CSpinner,
  CTabContent,
  CTabPane,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPen, cilTrash, cilSearch, cilList } from '@coreui/icons';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHead } from '../../../components/PageHead';
import {
  catalogServicesApi, catalogPartsApi,
  type CatalogService, type CatalogPart,
} from '../../../services/catalog.service';

// --- Schemas Zod ---
const serviceSchema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  descricao: z.string().optional(),
  precoPadrao: z.coerce.number().min(0, 'Deve ser ≥ 0'),
});
type ServiceForm = z.infer<typeof serviceSchema>;

const partSchema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  codigo: z.string().optional(),
  precoUnitario: z.coerce.number().min(0, 'Deve ser ≥ 0'),
});
type PartForm = z.infer<typeof partSchema>;

// --- ServicesTab ---
function ServicesTab() {
  const [items, setItems] = useState<CatalogService[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogService | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema) as Resolver<ServiceForm>,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await catalogServicesApi.list({ page: page + 1, limit: rowsPerPage, search: search || undefined });
      setItems(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar serviços.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ nome: '', descricao: '', precoPadrao: 0 }); setModalOpen(true); };
  const openEdit = (item: CatalogService) => {
    setEditing(item);
    reset({ nome: item.nome, descricao: item.descricao ?? '', precoPadrao: item.precoPadrao });
    setModalOpen(true);
  };

  const onSubmit = async (values: ServiceForm) => {
    try {
      if (editing) {
        await catalogServicesApi.update(editing.id, values);
      } else {
        await catalogServicesApi.create(values);
      }
      setModalOpen(false);
      load();
    } catch {
      alert('Erro ao salvar serviço.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este serviço?')) return;
    try {
      await catalogServicesApi.delete(id);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir serviço.');
    }
  };

  const totalPages = Math.ceil(total / rowsPerPage) || 1;
  const shownFrom = total === 0 ? 0 : page * rowsPerPage + 1;
  const shownTo = Math.min((page + 1) * rowsPerPage, total);

  return (
    <div style={{ marginTop: 16 }}>
      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <div className="pk-table-card">
        <div className="pk-table-toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <CIcon icon={cilSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--cui-secondary-color)', pointerEvents: 'none', width: 14, height: 14 }} />
            <CFormInput
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ paddingLeft: 36 }}
              size="sm"
            />
          </div>
          <CButton color="primary" size="sm" onClick={openCreate} style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CIcon icon={cilPlus} size="sm" /> Novo serviço
          </CButton>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Descrição</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Preço padrão</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : items.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-5">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(52,142,145,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CIcon icon={cilList} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600 }}>Nenhum serviço cadastrado</div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {search ? 'Tente ajustar sua busca.' : 'Adicione o primeiro serviço para começar.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : items.map((item) => (
              <CTableRow key={item.id}>
                <CTableDataCell style={{ fontWeight: 500 }}>{item.nome}</CTableDataCell>
                <CTableDataCell style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>{item.descricao ?? '—'}</CTableDataCell>
                <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  R$ {Number(item.precoPadrao).toFixed(2).replace('.', ',')}
                </CTableDataCell>
                <CTableDataCell style={{ textAlign: 'right' }}>
                  <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(item)} title="Editar">
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(item.id)} title="Excluir">
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>

        <div className="pk-table-footer">
          <span>{total > 0 ? `Mostrando ${shownFrom}–${shownTo} de ${total}` : 'Nenhum registro'}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <select className="form-select form-select-sm" style={{ width: 72 }} value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}>
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              <CButton color="secondary" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</CButton>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', fontWeight: 500, color: 'var(--cui-body-color)' }}>{page + 1} / {totalPages}</span>
              <CButton color="secondary" variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>›</CButton>
            </div>
          </div>
        </div>
      </div>

      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <CModalHeader>
          <CModalTitle>{editing ? 'Editar serviço' : 'Novo serviço'}</CModalTitle>
        </CModalHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CModalBody>
            <div className="d-flex flex-column gap-3">
              <div>
                <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Nome *</CFormLabel>
                <CFormInput {...register('nome')} invalid={!!errors.nome} />
                {errors.nome && <CFormFeedback invalid>{errors.nome.message}</CFormFeedback>}
              </div>
              <div>
                <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Descrição</CFormLabel>
                <CFormTextarea {...register('descricao')} rows={2} />
              </div>
              <div>
                <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Preço padrão (R$) *</CFormLabel>
                <CFormInput type="number" step="0.01" min="0" {...register('precoPadrao')} invalid={!!errors.precoPadrao} />
                {errors.precoPadrao && <CFormFeedback invalid>{errors.precoPadrao.message}</CFormFeedback>}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</CButton>
            <CButton type="submit" color="primary">Salvar</CButton>
          </CModalFooter>
        </form>
      </CModal>
    </div>
  );
}

// --- PartsTab ---
function PartsTab() {
  const [items, setItems] = useState<CatalogPart[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogPart | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PartForm>({
    resolver: zodResolver(partSchema) as Resolver<PartForm>,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await catalogPartsApi.list({ page: page + 1, limit: rowsPerPage, search: search || undefined });
      setItems(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar peças.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ nome: '', codigo: '', precoUnitario: 0 }); setModalOpen(true); };
  const openEdit = (item: CatalogPart) => {
    setEditing(item);
    reset({ nome: item.nome, codigo: item.codigo ?? '', precoUnitario: item.precoUnitario });
    setModalOpen(true);
  };

  const onSubmit = async (values: PartForm) => {
    try {
      if (editing) {
        await catalogPartsApi.update(editing.id, values);
      } else {
        await catalogPartsApi.create(values);
      }
      setModalOpen(false);
      load();
    } catch {
      alert('Erro ao salvar peça.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta peça?')) return;
    try {
      await catalogPartsApi.delete(id);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir peça.');
    }
  };

  const totalPages = Math.ceil(total / rowsPerPage) || 1;
  const shownFrom = total === 0 ? 0 : page * rowsPerPage + 1;
  const shownTo = Math.min((page + 1) * rowsPerPage, total);

  return (
    <div style={{ marginTop: 16 }}>
      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <div className="pk-table-card">
        <div className="pk-table-toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <CIcon icon={cilSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--cui-secondary-color)', pointerEvents: 'none', width: 14, height: 14 }} />
            <CFormInput
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ paddingLeft: 36 }}
              size="sm"
            />
          </div>
          <CButton color="primary" size="sm" onClick={openCreate} style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CIcon icon={cilPlus} size="sm" /> Nova peça
          </CButton>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Código</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Preço unitário</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : items.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-5">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(52,142,145,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CIcon icon={cilList} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600 }}>Nenhuma peça cadastrada</div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {search ? 'Tente ajustar sua busca.' : 'Adicione a primeira peça para começar.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : items.map((item) => (
              <CTableRow key={item.id}>
                <CTableDataCell style={{ fontWeight: 500 }}>{item.nome}</CTableDataCell>
                <CTableDataCell style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                  {item.codigo ?? '—'}
                </CTableDataCell>
                <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  R$ {Number(item.precoUnitario).toFixed(2).replace('.', ',')}
                </CTableDataCell>
                <CTableDataCell style={{ textAlign: 'right' }}>
                  <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(item)} title="Editar">
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(item.id)} title="Excluir">
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>

        <div className="pk-table-footer">
          <span>{total > 0 ? `Mostrando ${shownFrom}–${shownTo} de ${total}` : 'Nenhum registro'}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <select className="form-select form-select-sm" style={{ width: 72 }} value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}>
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              <CButton color="secondary" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</CButton>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', fontWeight: 500, color: 'var(--cui-body-color)' }}>{page + 1} / {totalPages}</span>
              <CButton color="secondary" variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>›</CButton>
            </div>
          </div>
        </div>
      </div>

      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <CModalHeader>
          <CModalTitle>{editing ? 'Editar peça' : 'Nova peça'}</CModalTitle>
        </CModalHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CModalBody>
            <div className="d-flex flex-column gap-3">
              <div>
                <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Nome *</CFormLabel>
                <CFormInput {...register('nome')} invalid={!!errors.nome} />
                {errors.nome && <CFormFeedback invalid>{errors.nome.message}</CFormFeedback>}
              </div>
              <div>
                <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Código / Referência</CFormLabel>
                <CFormInput {...register('codigo')} />
              </div>
              <div>
                <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Preço unitário (R$) *</CFormLabel>
                <CFormInput type="number" step="0.01" min="0" {...register('precoUnitario')} invalid={!!errors.precoUnitario} />
                {errors.precoUnitario && <CFormFeedback invalid>{errors.precoUnitario.message}</CFormFeedback>}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</CButton>
            <CButton type="submit" color="primary">Salvar</CButton>
          </CModalFooter>
        </form>
      </CModal>
    </div>
  );
}

// --- CatalogPage ---
export function CatalogPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <>
      <PageHead title="Catálogo" subtitle="Serviços e peças disponíveis para compor orçamentos e OS" />

      <div style={{ borderBottom: '1px solid var(--cui-border-color)' }}>
        <CNav variant="tabs" className="pk-tabs" style={{ border: 0 }}>
          <CNavItem>
            <CNavLink active={activeTab === 0} onClick={() => setActiveTab(0)} style={{ cursor: 'pointer' }}>
              Serviços
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === 1} onClick={() => setActiveTab(1)} style={{ cursor: 'pointer' }}>
              Peças
            </CNavLink>
          </CNavItem>
        </CNav>
      </div>

      <CTabContent>
        <CTabPane visible={activeTab === 0}><ServicesTab /></CTabPane>
        <CTabPane visible={activeTab === 1}><PartsTab /></CTabPane>
      </CTabContent>
    </>
  );
}
