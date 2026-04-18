import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CAlert, CButton, CFormSwitch, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilArrowLeft } from '@coreui/icons';
import {
  employeesService,
  type EmployeePermissions,
} from '../../../services/recycling/employees.service';

// ── Types & groups ──────────────────────────────────────────────────────────
type PermissionsFormData = Omit<EmployeePermissions, 'userId'>;

interface PermissionGroup {
  title: string;
  desc: string;
  items: Array<{
    key: keyof PermissionsFormData;
    label: string;
    desc: string;
  }>;
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Operações diárias',
    desc: 'Permissões que controlam o fluxo operacional',
    items: [
      {
        key: 'canOpenCloseCash',
        label: 'Abrir e fechar caixa',
        desc: 'Iniciar e encerrar sessões de caixa',
      },
      {
        key: 'canRegisterPurchases',
        label: 'Registrar compras',
        desc: 'Lançar entradas de material de fornecedores',
      },
      {
        key: 'canRegisterSales',
        label: 'Registrar vendas',
        desc: 'Lançar saídas de material para compradores',
      },
    ],
  },
  {
    title: 'Cadastros',
    desc: 'Gerenciamento de entidades do sistema',
    items: [
      {
        key: 'canManageSuppliers',
        label: 'Gerenciar fornecedores',
        desc: 'Criar, editar e excluir fornecedores',
      },
      {
        key: 'canManageBuyers',
        label: 'Gerenciar compradores',
        desc: 'Criar, editar e excluir compradores',
      },
      {
        key: 'canManageProducts',
        label: 'Gerenciar produtos',
        desc: 'Criar, editar e inativar produtos',
      },
    ],
  },
  {
    title: 'Consultas',
    desc: 'Visualização de dados consolidados',
    items: [
      {
        key: 'canViewStock',
        label: 'Visualizar estoque',
        desc: 'Ver saldos e histórico de movimentações',
      },
      {
        key: 'canViewReports',
        label: 'Visualizar relatórios',
        desc: 'Acessar métricas e exportações',
      },
    ],
  },
];

// ── Main ────────────────────────────────────────────────────────────────────

export function EmployeePermissionsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<PermissionsFormData>();

  useEffect(() => {
    if (!id) return;
    employeesService
      .getPermissions(id)
      .then((perms) => {
        const { userId: _userId, ...rest } = perms;
        void _userId;
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError('root' as keyof PermissionsFormData, {
        message: e?.response?.data?.message ?? 'Erro ao salvar permissões.',
      });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <CSpinner color="primary" />
      </div>
    );
  }

  if (fetchError) {
    return <CAlert color="danger">{fetchError}</CAlert>;
  }

  const rootError = (errors as Record<string, { message?: string } | undefined>).root;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {/* Page head */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          onClick={() => navigate('/recycling/employees')}
          style={{ padding: '4px 10px', borderRadius: 8 }}
          aria-label="Voltar"
        >
          <CIcon icon={cilArrowLeft} size="sm" />
        </CButton>
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
            Permissões do funcionário
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            Controle granular de acesso por área do sistema.
          </p>
        </div>
      </div>

      {rootError && (
        <CAlert color="danger" className="mb-0">
          {rootError.message}
        </CAlert>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {PERMISSION_GROUPS.map((group) => (
          <div
            key={group.title}
            style={{
              background: 'var(--cui-card-bg)',
              border: '1px solid var(--cui-border-color)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--cui-border-color)',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--cui-body-color)',
                }}
              >
                {group.title}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--cui-secondary-color)',
                  marginTop: 2,
                }}
              >
                {group.desc}
              </div>
            </div>

            {group.items.map((item, i) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '14px 20px',
                  borderTop: i === 0 ? 0 : '1px solid var(--cui-border-color)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: 'var(--cui-body-color)',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--cui-secondary-color)',
                      marginTop: 2,
                    }}
                  >
                    {item.desc}
                  </div>
                </div>
                <CFormSwitch {...register(item.key)} />
              </div>
            ))}
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
          }}
        >
          <CButton
            type="button"
            color="secondary"
            variant="outline"
            onClick={() => navigate('/recycling/employees')}
            style={{ borderRadius: 8, minWidth: 120 }}
          >
            Cancelar
          </CButton>
          <CButton
            type="submit"
            color="primary"
            disabled={isSubmitting}
            style={{ borderRadius: 8, minWidth: 120 }}
          >
            {isSubmitting ? <CSpinner size="sm" /> : 'Salvar permissões'}
          </CButton>
        </div>
      </form>
    </div>
  );
}
