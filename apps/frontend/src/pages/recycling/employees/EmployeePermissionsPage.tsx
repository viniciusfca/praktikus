import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CFormSwitch,
  CSpinner,
} from '@coreui/react';
import {
  employeesService,
  type EmployeePermissions,
} from '../../../services/recycling/employees.service';

type PermissionsFormData = Omit<EmployeePermissions, 'userId'>;

const PERMISSION_LABELS: Record<keyof PermissionsFormData, string> = {
  canManageSuppliers: 'Gerenciar Fornecedores',
  canManageBuyers: 'Gerenciar Compradores',
  canManageProducts: 'Gerenciar Produtos',
  canOpenCloseCash: 'Abrir/Fechar Caixa',
  canViewStock: 'Visualizar Estoque',
  canViewReports: 'Visualizar Relatórios',
  canRegisterPurchases: 'Registrar Compras',
  canRegisterSales: 'Registrar Vendas',
};

export function EmployeePermissionsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
    setError,
    formState: { errors },
  } = useForm<PermissionsFormData>();

  useEffect(() => {
    if (!id) return;
    employeesService
      .getPermissions(id)
      .then((perms) => {
        const { userId: _userId, ...rest } = perms;
        reset(rest);
      })
      .catch(() => setFetchError('Erro ao carregar permissões.'))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: PermissionsFormData) => {
    if (!id) return;
    try {
      await employeesService.updatePermissions(id, data);
      navigate('/recycling/employees');
    } catch (err: any) {
      setError('root' as any, {
        message: err?.response?.data?.message ?? 'Erro ao salvar permissões.',
      });
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <CSpinner />
      </div>
    );
  }

  if (fetchError) {
    return <CAlert color="danger">{fetchError}</CAlert>;
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h5 className="fw-bold mb-4">Permissões do Funcionário</h5>

      <CCard>
        <CCardBody className="p-4">
          {(errors as any).root && (
            <CAlert color="danger" className="mb-3">{(errors as any).root.message}</CAlert>
          )}
          <form onSubmit={handleSubmit(onSubmit)}>
            {(Object.keys(PERMISSION_LABELS) as Array<keyof PermissionsFormData>).map((key) => (
              <div key={key} className="mb-3">
                <CFormSwitch
                  label={PERMISSION_LABELS[key]}
                  {...register(key)}
                />
              </div>
            ))}
            <div className="d-flex gap-2 mt-4">
              <CButton
                color="secondary"
                variant="outline"
                className="flex-grow-1"
                onClick={() => navigate('/recycling/employees')}
              >
                Cancelar
              </CButton>
              <CButton type="submit" color="primary" className="flex-grow-1" disabled={isSubmitting}>
                {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
              </CButton>
            </div>
          </form>
        </CCardBody>
      </CCard>
    </div>
  );
}
