import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CCard,
  CFormInput,
  CPagination,
  CPaginationItem,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilSearch, cilPen, cilTrash } from '@coreui/icons';
import { customersService, type Customer } from '../../../services/customers.service';

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

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Clientes</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/workshop/customers/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Cliente
        </CButton>
      </div>

      <CFormInput
        placeholder="Buscar por nome ou CPF/CNPJ"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="mb-3"
        style={{ maxWidth: 360 }}
        size="sm"
      />

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>CPF/CNPJ</CTableHeaderCell>
              <CTableHeaderCell>WhatsApp</CTableHeaderCell>
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
            ) : customers.map((c) => (
              <CTableRow key={c.id}>
                <CTableDataCell>{c.nome}</CTableDataCell>
                <CTableDataCell>{c.cpfCnpj}</CTableDataCell>
                <CTableDataCell>{c.whatsapp ?? '—'}</CTableDataCell>
                <CTableDataCell className="text-end">
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
    </>
  );
}
