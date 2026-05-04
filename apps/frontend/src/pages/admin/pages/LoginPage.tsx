import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { adminAuthService } from '../../../services/admin-auth.service';
import { usePlatformAuthStore } from '../../../store/platform-auth.store';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import '../styles/admin-tokens.css';
import '../styles/admin-components.css';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha muito curta'),
});

type Form = z.infer<typeof schema>;

export function LoginPage() {
  const setTokens = usePlatformAuthStore((s) => s.setTokens);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Form) {
    setSubmitError(null);
    try {
      const tokens = await adminAuthService.login(values);
      setTokens(tokens);
      const last = localStorage.getItem('pk_admin_page');
      navigate(last && last.startsWith('/admin') ? last : '/admin', {
        replace: true,
      });
    } catch (err: any) {
      setSubmitError(
        err?.response?.status === 401
          ? 'E-mail ou senha incorretos.'
          : 'Falha ao entrar. Tente novamente.',
      );
    }
  }

  return (
    <div
      className="adm-root"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--adm-bg-subtle)',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <Card>
          <h1 style={{ fontSize: 18, marginTop: 0, marginBottom: 4 }}>
            Praktikus Admin
          </h1>
          <p
            style={{
              fontSize: 12,
              color: 'var(--adm-fg-muted)',
              marginTop: 0,
              marginBottom: 16,
            }}
          >
            Console do administrador
          </p>
          <form
            onSubmit={handleSubmit(onSubmit)}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              E-mail
              <input
                type="email"
                autoComplete="username"
                {...register('email')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--adm-border)',
                  borderRadius: 6,
                  fontSize: 13,
                  marginTop: 4,
                }}
              />
              {errors.email && (
                <small style={{ color: 'var(--adm-danger)' }}>
                  {errors.email.message}
                </small>
              )}
            </label>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                {...register('password')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--adm-border)',
                  borderRadius: 6,
                  fontSize: 13,
                  marginTop: 4,
                }}
              />
              {errors.password && (
                <small style={{ color: 'var(--adm-danger)' }}>
                  {errors.password.message}
                </small>
              )}
            </label>
            {submitError && (
              <div
                role="alert"
                style={{
                  fontSize: 12,
                  color: 'var(--adm-danger)',
                  background: 'var(--adm-danger-bg)',
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                {submitError}
              </div>
            )}
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
            <button
              type="button"
              disabled
              title="Em breve"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--adm-fg-subtle)',
                fontSize: 12,
                cursor: 'not-allowed',
              }}
            >
              Esqueci a senha
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
