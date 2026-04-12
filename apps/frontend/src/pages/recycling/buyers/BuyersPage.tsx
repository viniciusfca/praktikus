import { useState } from 'react';
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
import { useBuyers } from '../../../hooks/recycling/useBuyers';
import { buyersService, type Buyer } from '../../../services/recycling/buyers.service';

export function BuyersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 20;

  const { buyers, total, loading, error, reload } = useBuyers(page, limit, search || undefined);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async (buyer: Buyer) => {
    if (!confirm(`Excluir comprador "${buyer.name}"?`)) return;
    try {
      await buyersService.delete(buyer.id);
      reload();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      alert(anyErr?.response?.data?.message ?? 'Erro ao excluir comprador.');
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Compradores</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/recycling/buyers/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Comprador
        </CButton>
      </div>

      <div className="mb-3">
        <CInputGroup>
          <CFormInput
            placeholder="Buscar por nome..."
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
              <CTableHeaderCell>CNPJ</CTableHeaderCell>
              <CTableHeaderCell>Telefone</CTableHeaderCell>
              <CTableHeaderCell>Contato</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : buyers.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center py-3 text-muted">
                  Nenhum comprador encontrado.
                </CTableDataCell>
              </CTableRow>
            ) : buyers.map((b) => (
              <CTableRow key={b.id}>
                <CTableDataCell>{b.name}</CTableDataCell>
                <CTableDataCell>{b.cnpj ? b.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : '—'}</CTableDataCell>
                <CTableDataCell>{b.phone ?? '—'}</CTableDataCell>
                <CTableDataCell>{b.contactName ?? '—'}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/recycling/buyers/${b.id}/edit`)}
                    title="Editar"
                  >
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(b)}
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
