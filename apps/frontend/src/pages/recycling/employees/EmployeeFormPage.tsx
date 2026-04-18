import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilArrowLeft } from '@coreui/icons';
import { employeesService } from '../../../services/recycling/employees.service';

// ── Schema ──────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

type FormData = z.infer<typeof schema>;

// ── Helpers ─────────────────────────────────────────────────────────────────
const labelStyle = { fontWeight: 500, fontSize: 13 };

// ── Main ────────────────────────────────────────────────────────────────────

export function EmployeeFormPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await employeesService.create(data);
      navigate('/recycling/employees');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError('root', {
        message: e?.response?.data?.message ?? 'Erro ao salvar funcionário.',
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
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
            Novo funcionário
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            As permissões serão definidas após a criação.
          </p>
        </div>
      </div>

      {errors.root && <CAlert color="danger" className="mb-0">{errors.root.message}</CAlert>}

      <div
        style={{
          background: 'var(--cui-card-bg)',
          border: '1px solid var(--cui-border-color)',
          borderRadius: 14,
          padding: 20,
        }}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <CFormLabel style={labelStyle}>Nome *</CFormLabel>
            <CFormInput {...register('name')} invalid={!!errors.name} />
            {errors.name && <CFormFeedback invalid>{errors.name.message}</CFormFeedback>}
          </div>

          <div>
            <CFormLabel style={labelStyle}>E-mail *</CFormLabel>
            <CFormInput
              type="email"
              placeholder="funcionario@empresa.com"
              {...register('email')}
              invalid={!!errors.email}
            />
            {errors.email && <CFormFeedback invalid>{errors.email.message}</CFormFeedback>}
          </div>

          <div>
            <CFormLabel style={labelStyle}>Senha temporária *</CFormLabel>
            <CFormInput
              type="password"
              placeholder="Mínimo 8 caracteres"
              {...register('password')}
              invalid={!!errors.password}
            />
            {errors.password && (
              <CFormFeedback invalid>{errors.password.message}</CFormFeedback>
            )}
            <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)', marginTop: 4 }}>
              O funcionário pode alterar a senha após o primeiro login.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 8,
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
              {isSubmitting ? <CSpinner size="sm" /> : 'Criar funcionário'}
            </CButton>
          </div>
        </form>
      </div>
    </div>
  );
}
