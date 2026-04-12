import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CCard,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilLockLocked, cilTrash } from '@coreui/icons';
import { employeesService, type Employee } from '../../../services/recycling/employees.service';

export function EmployeesPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await employeesService.list();
      setEmployees(data);
    } catch {
      setError('Erro ao carregar funcionários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este funcionário?')) return;
    try {
      await employeesService.delete(id);
      loadEmployees();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir funcionário.');
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Funcionários</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/recycling/employees/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Funcionário
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>E-mail</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : employees.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-3 text-secondary">
                  Nenhum funcionário cadastrado.
                </CTableDataCell>
              </CTableRow>
            ) : employees.map((emp) => (
              <CTableRow key={emp.id}>
                <CTableDataCell>{emp.name}</CTableDataCell>
                <CTableDataCell>{emp.email}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/recycling/employees/${emp.id}/permissions`)}
                    title="Permissões"
                  >
                    <CIcon icon={cilLockLocked} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(emp.id)}
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
    </>
  );
}
