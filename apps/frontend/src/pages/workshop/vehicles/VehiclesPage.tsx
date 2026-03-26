import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CBadge,
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
import { cilPlus, cilHistory, cilPen, cilTrash } from '@coreui/icons';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

export function VehiclesPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await vehiclesService.list({
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
      });
      setVehicles(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar veículos.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este veículo?')) return;
    try {
      await vehiclesService.delete(id);
      loadVehicles();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir.');
    }
  };

  const totalPages = Math.ceil(total / rowsPerPage) || 1;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Veículos</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/workshop/vehicles/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Veículo
        </CButton>
      </div>

      <CFormInput
        placeholder="Buscar por placa, marca ou modelo"
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
              <CTableHeaderCell>Placa</CTableHeaderCell>
              <CTableHeaderCell>Marca</CTableHeaderCell>
              <CTableHeaderCell>Modelo</CTableHeaderCell>
              <CTableHeaderCell>Ano</CTableHeaderCell>
              <CTableHeaderCell>KM</CTableHeaderCell>
              <CTableHeaderCell>Cliente</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={7} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : vehicles.map((v) => (
              <CTableRow key={v.id}>
                <CTableDataCell>
                  <CBadge color="secondary">{v.placa}</CBadge>
                </CTableDataCell>
                <CTableDataCell>{v.marca}</CTableDataCell>
                <CTableDataCell>{v.modelo}</CTableDataCell>
                <CTableDataCell>{v.ano}</CTableDataCell>
                <CTableDataCell>{v.km.toLocaleString()} km</CTableDataCell>
                <CTableDataCell>
                  <CBadge
                    color="info"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/workshop/customers/${v.customerId}`)}
                  >
                    {v.customerId.slice(0, 8)}…
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    title="Prontuário"
                    onClick={() => navigate(`/workshop/vehicles/${v.id}/history`)}
                  >
                    <CIcon icon={cilHistory} />
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    title="Editar"
                    onClick={() => navigate(`/workshop/vehicles/${v.id}/edit`)}
                  >
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    title="Excluir"
                    onClick={() => handleDelete(v.id)}
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
