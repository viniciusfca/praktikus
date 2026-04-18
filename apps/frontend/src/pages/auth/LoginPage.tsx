import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { AuthShell } from '../../components/AuthShell';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';
import { jwtDecode } from 'jwt-decode';
import type { JwtUser } from '../../store/auth.store';

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
      const decoded = jwtDecode<JwtUser>(tokens.access_token);
      if (decoded.tenant_segment === 'RECYCLING') {
        navigate('/recycling/dashboard');
      } else {
        navigate('/workshop/dashboard');
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      setError(msg ?? 'Erro ao fazer login.');
    }
  };

  return (
    <AuthShell>
      <h1
        style={{
          margin: '0 0 6px',
          fontSize: 26,
          letterSpacing: '-0.02em',
          fontWeight: 600,
        }}
      >
        Bem-vindo de volta
      </h1>
      <p style={{ margin: '0 0 28px', color: 'var(--cui-secondary-color)' }}>
        Entre para continuar gerenciando seu negócio.
      </p>

      {error && (
        <CAlert color="danger" className="mb-3">
          {error}
        </CAlert>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div>
          <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>E-mail</CFormLabel>
          <CFormInput
            type="email"
            placeholder="voce@suaempresa.com.br"
            {...register('email')}
            invalid={!!errors.email}
            aria-label="E-mail"
          />
          {errors.email && <CFormFeedback invalid>{errors.email.message}</CFormFeedback>}
        </div>

        <div>
          <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Senha</CFormLabel>
          <CFormInput
            type="password"
            placeholder="••••••••"
            {...register('password')}
            invalid={!!errors.password}
            aria-label="Senha"
          />
          {errors.password && (
            <CFormFeedback invalid>{errors.password.message}</CFormFeedback>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 2,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--cui-secondary-color)',
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" /> Lembrar de mim
          </label>
          <a
            href="#"
            style={{
              fontSize: 13,
              color: 'var(--cui-primary)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Esqueci a senha
          </a>
        </div>

        <CButton
          type="submit"
          color="primary"
          size="lg"
          style={{ width: '100%', marginTop: 4, borderRadius: 8 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? <CSpinner size="sm" /> : 'Entrar'}
        </CButton>
      </form>

      <p
        style={{
          marginTop: 24,
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--cui-secondary-color)',
        }}
      >
        Ainda não tem conta?{' '}
        <Link
          to="/register"
          style={{ color: 'var(--cui-primary)', fontWeight: 500, textDecoration: 'none' }}
        >
          Comece grátis
        </Link>
      </p>
    </AuthShell>
  );
}
