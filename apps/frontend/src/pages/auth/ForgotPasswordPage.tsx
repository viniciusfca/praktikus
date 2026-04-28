import { useState } from 'react';
import { Link } from 'react-router-dom';
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

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await authService.forgotPassword(data.email);
      setSubmitted(true);
    } catch {
      setError('Erro ao processar solicitação. Tente novamente.');
    }
  };

  if (submitted) {
    return (
      <AuthShell>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-0.02em', fontWeight: 600 }}>
          Confira seu e-mail
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--cui-secondary-color)', lineHeight: 1.55 }}>
          Se essa conta existir, enviamos um link para recuperar sua senha. Verifique sua caixa de entrada e o spam.
        </p>
        <Link
          to="/login"
          style={{
            color: 'var(--cui-primary)',
            fontWeight: 500,
            textDecoration: 'none',
            fontSize: 13.5,
          }}
        >
          ← Voltar ao login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-0.02em', fontWeight: 600 }}>
        Recuperar senha
      </h1>
      <p style={{ margin: '0 0 28px', color: 'var(--cui-secondary-color)' }}>
        Informe seu e-mail e enviaremos um link para redefinir sua senha.
      </p>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

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

        <CButton
          type="submit"
          color="primary"
          size="lg"
          style={{ width: '100%', marginTop: 4, borderRadius: 8 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? <CSpinner size="sm" /> : 'Enviar link'}
        </CButton>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--cui-secondary-color)' }}>
        Lembrou a senha?{' '}
        <Link to="/login" style={{ color: 'var(--cui-primary)', fontWeight: 500, textDecoration: 'none' }}>
          Voltar ao login
        </Link>
      </p>
    </AuthShell>
  );
}
