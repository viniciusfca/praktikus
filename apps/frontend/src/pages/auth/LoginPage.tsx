import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const tokens = await authService.login(data);
      setTokens(tokens);
      navigate('/workshop/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      setError(msg ?? 'Erro ao fazer login.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <CCard style={{ width: '100%', maxWidth: 420 }}>
        <CCardBody className="p-4">
          <h5 className="fw-bold text-center mb-1">Practicus</h5>
          <p className="text-secondary text-center mb-3">Acesse sua conta</p>

          {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-3">
              <CFormLabel>E-mail</CFormLabel>
              <CFormInput
                type="email"
                {...register('email')}
                invalid={!!errors.email}
                aria-label="E-mail"
              />
              {errors.email && <CFormFeedback invalid>{errors.email.message}</CFormFeedback>}
            </div>
            <div className="mb-3">
              <CFormLabel>Senha</CFormLabel>
              <CFormInput
                type="password"
                {...register('password')}
                invalid={!!errors.password}
                aria-label="Senha"
              />
              {errors.password && <CFormFeedback invalid>{errors.password.message}</CFormFeedback>}
            </div>
            <CButton
              type="submit"
              color="primary"
              className="w-100 mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? <CSpinner size="sm" /> : 'Entrar'}
            </CButton>
          </form>

          <p className="text-center mt-3 mb-0" style={{ fontSize: '0.875rem' }}>
            Não tem conta?{' '}
            <Link to="/register" style={{ color: 'inherit' }}>
              Cadastre sua oficina
            </Link>
          </p>
        </CCardBody>
      </CCard>
    </div>
  );
}
