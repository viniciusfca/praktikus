import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilLockLocked, cilTrash, cilGroup } from '@coreui/icons';
import { employeesService, type Employee } from '../../../services/recycling/employees.service';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function EmployeeAvatar({ name }: { name: string }) {
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

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Excluir funcionário "${emp.name}"?`)) return;
    try {
      await employeesService.delete(emp.id);
      loadEmployees();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e?.response?.data?.message ?? 'Erro ao excluir funcionário.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page head */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--cui-body-color)',
            }}
          >
            Funcionários
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {employees.length > 0
              ? `${employees.length} ${employees.length === 1 ? 'funcionário cadastrado' : 'funcionários cadastrados'}`
              : 'Gerencie sua equipe e permissões de acesso'}
          </p>
        </div>
        <CButton
          color="primary"
          onClick={() => navigate('/recycling/employees/new')}
          style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <CIcon icon={cilPlus} size="sm" /> Novo funcionário
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Table card */}
      <div className="pk-table-card">
        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>E-mail</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : employees.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-5">
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'rgba(52,142,145,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CIcon icon={cilGroup} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
                      Nenhum funcionário cadastrado
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      Cadastre o primeiro funcionário para delegar operações.
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : (
              employees.map((emp) => (
                <CTableRow key={emp.id}>
                  <CTableDataCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <EmployeeAvatar name={emp.name} />
                      <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{emp.name}</span>
                    </div>
                  </CTableDataCell>
                  <CTableDataCell style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>
                    {emp.email}
                  </CTableDataCell>
                  <CTableDataCell style={{ textAlign: 'right' }}>
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
                      onClick={() => handleDelete(emp)}
                      title="Excluir"
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))
            )}
          </CTableBody>
        </CTable>
      </div>
    </div>
  );
}
