import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

const schema = z
  .object({
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await authService.resetPassword(token, data.password);
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Não foi possível redefinir a senha.');
    }
  };

  if (success) {
    return (
      <AuthShell>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-0.02em', fontWeight: 600 }}>
          Senha redefinida!
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--cui-secondary-color)' }}>
          Você já pode entrar com a nova senha.
        </p>
        <Link
          to="/login"
          style={{
            display: 'inline-block',
            background: 'var(--cui-primary)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Ir para login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-0.02em', fontWeight: 600 }}>
        Definir nova senha
      </h1>
      <p style={{ margin: '0 0 28px', color: 'var(--cui-secondary-color)' }}>
        Escolha uma senha forte com pelo menos 8 caracteres.
      </p>

      {error && (
        <CAlert color="danger" className="mb-3">
          {error}
          {error.toLowerCase().includes('inválido') && (
            <>
              {' '}
              <Link
                to="/forgot-password"
                style={{ color: 'var(--cui-primary)', fontWeight: 600 }}
              >
                Pedir novo link
              </Link>
              .
            </>
          )}
        </CAlert>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div>
          <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Nova senha</CFormLabel>
          <CFormInput
            type="password"
            placeholder="••••••••"
            {...register('password')}
            invalid={!!errors.password}
            aria-label="Nova senha"
          />
          {errors.password && <CFormFeedback invalid>{errors.password.message}</CFormFeedback>}
        </div>

        <div>
          <CFormLabel style={{ fontWeight: 500, fontSize: 13 }}>Confirmar senha</CFormLabel>
          <CFormInput
            type="password"
            placeholder="••••••••"
            {...register('confirmPassword')}
            invalid={!!errors.confirmPassword}
            aria-label="Confirmar senha"
          />
          {errors.confirmPassword && (
            <CFormFeedback invalid>{errors.confirmPassword.message}</CFormFeedback>
          )}
        </div>

        <CButton
          type="submit"
          color="primary"
          size="lg"
          style={{ width: '100%', marginTop: 4, borderRadius: 8 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? <CSpinner size="sm" /> : 'Redefinir senha'}
        </CButton>
      </form>
    </AuthShell>
  );
}
