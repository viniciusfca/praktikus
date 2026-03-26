import { useState, useEffect, useCallback } from 'react';
import {
  CAlert,
  CButton,
  CCard,
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
  CPagination,
  CPaginationItem,
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
import { cilPlus, cilPen, cilTrash } from '@coreui/icons';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <CFormInput
          placeholder="Buscar por nome"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{ maxWidth: 320 }}
          size="sm"
        />
        <CButton color="primary" size="sm" onClick={openCreate}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Serviço
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Descrição</CTableHeaderCell>
              <CTableHeaderCell>Preço Padrão</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : items.map((item) => (
              <CTableRow key={item.id}>
                <CTableDataCell>{item.nome}</CTableDataCell>
                <CTableDataCell>{item.descricao ?? '—'}</CTableDataCell>
                <CTableDataCell>R$ {Number(item.precoPadrao).toFixed(2)}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>

        <div className="d-flex align-items-center gap-2 px-3 py-2 border-top">
          <select
            className="form-select form-select-sm"
            style={{ width: 80 }}
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          >
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <small className="text-secondary">por página</small>
          <CPagination className="ms-auto mb-0" size="sm">
            <CPaginationItem disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</CPaginationItem>
            <CPaginationItem active>{page + 1} / {totalPages}</CPaginationItem>
            <CPaginationItem disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>›</CPaginationItem>
          </CPagination>
        </div>
      </CCard>

      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <CModalHeader>
          <CModalTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</CModalTitle>
        </CModalHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CModalBody>
            <div className="d-flex flex-column gap-3">
              <div>
                <CFormLabel>Nome *</CFormLabel>
                <CFormInput {...register('nome')} invalid={!!errors.nome} />
                {errors.nome && <CFormFeedback invalid>{errors.nome.message}</CFormFeedback>}
              </div>
              <div>
                <CFormLabel>Descrição</CFormLabel>
                <CFormTextarea {...register('descricao')} rows={2} />
              </div>
              <div>
                <CFormLabel>Preço Padrão (R$) *</CFormLabel>
                <CFormInput type="number" step="0.01" min="0" {...register('precoPadrao')} invalid={!!errors.precoPadrao} />
                {errors.precoPadrao && <CFormFeedback invalid>{errors.precoPadrao.message}</CFormFeedback>}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setModalOpen(false)}>Cancelar</CButton>
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

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <CFormInput
          placeholder="Buscar por nome ou código"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{ maxWidth: 320 }}
          size="sm"
        />
        <CButton color="primary" size="sm" onClick={openCreate}>
          <CIcon icon={cilPlus} className="me-1" />
          Nova Peça
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Código</CTableHeaderCell>
              <CTableHeaderCell>Preço Unitário</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : items.map((item) => (
              <CTableRow key={item.id}>
                <CTableDataCell>{item.nome}</CTableDataCell>
                <CTableDataCell>{item.codigo ?? '—'}</CTableDataCell>
                <CTableDataCell>R$ {Number(item.precoUnitario).toFixed(2)}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>

        <div className="d-flex align-items-center gap-2 px-3 py-2 border-top">
          <select
            className="form-select form-select-sm"
            style={{ width: 80 }}
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          >
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <small className="text-secondary">por página</small>
          <CPagination className="ms-auto mb-0" size="sm">
            <CPaginationItem disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</CPaginationItem>
            <CPaginationItem active>{page + 1} / {totalPages}</CPaginationItem>
            <CPaginationItem disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>›</CPaginationItem>
          </CPagination>
        </div>
      </CCard>

      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <CModalHeader>
          <CModalTitle>{editing ? 'Editar Peça' : 'Nova Peça'}</CModalTitle>
        </CModalHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CModalBody>
            <div className="d-flex flex-column gap-3">
              <div>
                <CFormLabel>Nome *</CFormLabel>
                <CFormInput {...register('nome')} invalid={!!errors.nome} />
                {errors.nome && <CFormFeedback invalid>{errors.nome.message}</CFormFeedback>}
              </div>
              <div>
                <CFormLabel>Código / Referência</CFormLabel>
                <CFormInput {...register('codigo')} />
              </div>
              <div>
                <CFormLabel>Preço Unitário (R$) *</CFormLabel>
                <CFormInput type="number" step="0.01" min="0" {...register('precoUnitario')} invalid={!!errors.precoUnitario} />
                {errors.precoUnitario && <CFormFeedback invalid>{errors.precoUnitario.message}</CFormFeedback>}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setModalOpen(false)}>Cancelar</CButton>
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
      <h5 className="fw-bold mb-3">Catálogo</h5>
      <CNav variant="tabs">
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
      <CTabContent>
        <CTabPane visible={activeTab === 0}><ServicesTab /></CTabPane>
        <CTabPane visible={activeTab === 1}><PartsTab /></CTabPane>
      </CTabContent>
    </>
  );
}
