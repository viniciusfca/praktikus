import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CCard,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPen, cilTrash, cilSearch } from '@coreui/icons';
import { suppliersService, type Supplier } from '../../../services/recycling/suppliers.service';

function formatDocument(document: string | null, documentType: 'CPF' | 'CNPJ' | null): string {
  if (!document || !documentType) return '—';
  if (documentType === 'CPF') {
    return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function SuppliersPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await suppliersService.list(page, limit, search || undefined);
      setSuppliers(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar fornecedores.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Excluir fornecedor "${supplier.name}"?`)) return;
    try {
      await suppliersService.delete(supplier.id);
      loadSuppliers();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir fornecedor.');
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Fornecedores</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/recycling/suppliers/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Fornecedor
        </CButton>
      </div>

      <div className="mb-3">
        <CInputGroup>
          <CFormInput
            placeholder="Buscar por nome ou documento..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <CInputGroupText style={{ cursor: 'pointer' }} onClick={handleSearch}>
            <CIcon icon={cilSearch} />
          </CInputGroupText>
        </CInputGroup>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Documento</CTableHeaderCell>
              <CTableHeaderCell>Telefone</CTableHeaderCell>
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
            ) : suppliers.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-3 text-muted">
                  Nenhum fornecedor encontrado.
                </CTableDataCell>
              </CTableRow>
            ) : suppliers.map((s) => (
              <CTableRow key={s.id}>
                <CTableDataCell>{s.name}</CTableDataCell>
                <CTableDataCell>{formatDocument(s.document, s.documentType)}</CTableDataCell>
                <CTableDataCell>{s.phone ?? '—'}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/recycling/suppliers/${s.id}/edit`)}
                    title="Editar"
                  >
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(s)}
                    title="Excluir"
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCard>

      {total > limit && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <small className="text-muted">Total: {total}</small>
          <div className="d-flex gap-2">
            <CButton size="sm" color="secondary" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Anterior
            </CButton>
            <CButton size="sm" color="secondary" variant="outline" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>
              Próxima
            </CButton>
          </div>
        </div>
      )}
    </>
  );
}
