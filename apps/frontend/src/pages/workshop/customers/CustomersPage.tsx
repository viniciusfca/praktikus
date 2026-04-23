import { useState, useEffect, useCallback } from 'react';
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
import { cilPlus, cilSearch, cilPen, cilTrash, cilCloudUpload, cilUser } from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import { customersService, type Customer } from '../../../services/customers.service';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function CustomerAvatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        background: 'rgba(52,142,145,0.12)',
        color: 'var(--cui-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11.5,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await customersService.list({
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
      });
      setCustomers(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este cliente?')) return;
    try {
      await customersService.delete(id);
      loadCustomers();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir cliente.');
    }
  };

  const totalPages = Math.ceil(total / rowsPerPage) || 1;
  const shownFrom = total === 0 ? 0 : page * rowsPerPage + 1;
  const shownTo = Math.min((page + 1) * rowsPerPage, total);

  return (
    <>
      <PageHead
        title="Clientes"
        subtitle={total > 0 ? `${total} ${total === 1 ? 'cliente' : 'clientes'} cadastrados` : 'Gerencie sua base de clientes'}
        actions={
          <>
            <CButton color="secondary" variant="outline" style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CIcon icon={cilCloudUpload} size="sm" /> Importar
            </CButton>
            <CButton color="primary" style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/workshop/customers/new')}>
              <CIcon icon={cilPlus} size="sm" /> Novo cliente
            </CButton>
          </>
        }
      />

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <div className="pk-table-card">
        <div className="pk-table-toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
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
              placeholder="Buscar por nome, CPF/CNPJ ou WhatsApp..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar clientes"
            />
          </div>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>CPF / CNPJ</CTableHeaderCell>
              <CTableHeaderCell>Contato</CTableHeaderCell>
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
            ) : customers.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-5">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'rgba(52,142,145,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CIcon icon={cilUser} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>Nenhum cliente encontrado</div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {search ? 'Tente ajustar sua busca.' : 'Cadastre o primeiro cliente para começar.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : customers.map((c) => (
              <CTableRow key={c.id}>
                <CTableDataCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CustomerAvatar name={c.nome} />
                    <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{c.nome}</span>
                  </div>
                </CTableDataCell>
                <CTableDataCell style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--cui-secondary-color)', fontSize: 12.5 }}>
                  {c.cpfCnpj}
                </CTableDataCell>
                <CTableDataCell>
                  <div style={{ fontSize: 12.5, color: 'var(--cui-body-color)' }}>
                    {c.whatsapp ?? '—'}
                  </div>
                </CTableDataCell>
                <CTableDataCell style={{ textAlign: 'right' }}>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/customers/${c.id}`)}
                    title="Ver detalhes"
                  >
                    <CIcon icon={cilSearch} />
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/customers/${c.id}/edit`)}
                    title="Editar"
                  >
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(c.id)}
                    title="Excluir"
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>

        <div className="pk-table-footer">
          <span>
            {total > 0 ? `Mostrando ${shownFrom}–${shownTo} de ${total}` : 'Nenhum registro'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              className="form-select form-select-sm"
              style={{ width: 72 }}
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
              aria-label="Itens por página"
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
              >
                ‹
              </CButton>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', fontWeight: 500, color: 'var(--cui-body-color)' }}>
                {page + 1} / {totalPages}
              </span>
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
              >
                ›
              </CButton>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
